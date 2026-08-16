import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import type {
  EvidenceIntegrity,
  EvidenceIntegrityReason,
  MediaEvidence,
} from '../domain/types';
import {
  contentAddressedImageName,
  digestToHex,
  estimateBase64Bytes,
  isSha256Hex,
  isSupportedImageMimeType,
  MAX_NATIVE_EVIDENCE_BYTES,
  MAX_WEB_INLINE_EVIDENCE_BYTES,
  parseInlineImageDataUri,
} from './evidenceFilePolicy';

export interface PersistedEvidenceFile {
  uri: string;
  sha256: string;
  sizeBytes: number;
  storage: 'app-file' | 'inline-web';
  integrity: EvidenceIntegrity;
}

export interface PreparedEvidenceFiles {
  media: MediaEvidence[];
  createdFileUris: string[];
  obsoleteFileUris: string[];
}

export class EvidenceFileTooLargeError extends Error {
  constructor(
    readonly actualBytes: number,
    readonly maximumBytes: number,
  ) {
    super(`evidence file is ${actualBytes} bytes; maximum is ${maximumBytes}`);
    this.name = 'EvidenceFileTooLargeError';
  }
}

export class EvidenceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceIntegrityError';
  }
}

const evidenceDirectory = () => new Directory(Paths.document, 'field-media');

const checkedAt = () => new Date().toISOString();

const verified = (sha256: string): EvidenceIntegrity => ({
  status: 'verified',
  checkedAt: checkedAt(),
  actualSha256: sha256,
});

const invalid = (
  status: 'missing' | 'tampered',
  reason: EvidenceIntegrityReason,
  actualSha256?: string,
): EvidenceIntegrity => ({
  status,
  checkedAt: checkedAt(),
  reason,
  ...(actualSha256 ? { actualSha256 } : {}),
});

const hashBytes = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  digestToHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));

const decodeBase64 = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const allowlistedLocalFile = (uri: string): File | null => {
  const directory = evidenceDirectory();
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(prefix)) return null;
  try {
    const file = new File(uri);
    return new File(directory, file.name).uri === file.uri ? file : null;
  } catch {
    return null;
  }
};

const contentAddressedLocalFile = (
  uri: string,
  sha256: string,
  mimeType: string,
): File | null => {
  const file = allowlistedLocalFile(uri);
  if (!file) return null;
  try {
    return file.name === contentAddressedImageName(sha256, mimeType) ? file : null;
  } catch {
    return null;
  }
};

const writeContentAddressedFile = async (
  bytes: Uint8Array<ArrayBuffer>,
  sha256: string,
  mimeType: string,
): Promise<{ file: File; created: boolean }> => {
  const directory = evidenceDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, contentAddressedImageName(sha256, mimeType));
  if (destination.exists) {
    const existingBytes = await destination.bytes();
    if (existingBytes.byteLength !== bytes.byteLength || (await hashBytes(existingBytes)) !== sha256) {
      throw new EvidenceIntegrityError('content-addressed destination does not match its name');
    }
    return { file: destination, created: false };
  }

  const temporary = new File(
    directory,
    `.pending-${sha256}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  );
  let moved = false;
  try {
    temporary.create({ intermediates: true });
    temporary.write(bytes);
    const written = await temporary.bytes();
    if (written.byteLength !== bytes.byteLength || (await hashBytes(written)) !== sha256) {
      throw new EvidenceIntegrityError('evidence bytes changed during local persistence');
    }
    await temporary.move(destination);
    moved = true;
    return { file: destination, created: true };
  } catch (error) {
    if (!moved && temporary.exists) {
      try {
        temporary.delete();
      } catch {
        // Preserve the original persistence error.
      }
    }
    throw error;
  }
};

const persistInlineWebAsset = async (
  asset: ImagePickerAsset,
  mimeType: string,
): Promise<PersistedEvidenceFile> => {
  if (!isSupportedImageMimeType(mimeType)) throw new Error('unsupported evidence MIME type');
  if (!asset.base64) throw new Error('web image picker did not provide an inline copy');
  const sizeBytes = estimateBase64Bytes(asset.base64);
  if (sizeBytes > MAX_WEB_INLINE_EVIDENCE_BYTES) {
    throw new EvidenceFileTooLargeError(sizeBytes, MAX_WEB_INLINE_EVIDENCE_BYTES);
  }
  const bytes = decodeBase64(asset.base64);
  const sha256 = await hashBytes(bytes);
  return {
    uri: `data:${mimeType};base64,${asset.base64}`,
    sha256,
    sizeBytes,
    storage: 'inline-web',
    integrity: verified(sha256),
  };
};

const persistNativeAsset = async (
  asset: ImagePickerAsset,
  mimeType: string,
): Promise<PersistedEvidenceFile> => {
  if (!isSupportedImageMimeType(mimeType)) throw new Error('unsupported evidence MIME type');
  const reportedSize = asset.fileSize ?? 0;
  if (reportedSize > MAX_NATIVE_EVIDENCE_BYTES) {
    throw new EvidenceFileTooLargeError(reportedSize, MAX_NATIVE_EVIDENCE_BYTES);
  }

  const source = new File(asset.uri);
  const bytes = await source.bytes();
  const sizeBytes = bytes.byteLength;
  if (sizeBytes <= 0) throw new Error('source evidence file is empty');
  if (sizeBytes > MAX_NATIVE_EVIDENCE_BYTES) {
    throw new EvidenceFileTooLargeError(sizeBytes, MAX_NATIVE_EVIDENCE_BYTES);
  }
  const sha256 = await hashBytes(bytes);
  const { file } = await writeContentAddressedFile(bytes, sha256, mimeType);
  return {
    uri: file.uri,
    sha256,
    sizeBytes,
    storage: 'app-file',
    integrity: verified(sha256),
  };
};

export const persistEvidenceAsset = (
  asset: ImagePickerAsset,
  mimeType: string,
): Promise<PersistedEvidenceFile> =>
  Platform.OS === 'web'
    ? persistInlineWebAsset(asset, mimeType)
    : persistNativeAsset(asset, mimeType);

const verifyInlineEvidence = async (media: MediaEvidence): Promise<MediaEvidence> => {
  const parsed = parseInlineImageDataUri(media.uri);
  if (!parsed) {
    return { ...media, integrity: invalid('tampered', 'inline_data_invalid') };
  }
  if (parsed.mimeType !== media.mimeType.toLowerCase()) {
    return { ...media, integrity: invalid('tampered', 'mime_mismatch') };
  }
  const actualSha256 = await hashBytes(decodeBase64(parsed.base64));
  if (actualSha256 !== media.sha256) {
    return { ...media, integrity: invalid('tampered', 'sha256_mismatch', actualSha256) };
  }
  if (parsed.sizeBytes !== media.sizeBytes) {
    return { ...media, integrity: invalid('tampered', 'size_mismatch', actualSha256) };
  }
  return { ...media, integrity: verified(actualSha256) };
};

const verifyNativeEvidence = async (media: MediaEvidence): Promise<MediaEvidence> => {
  if (!isSha256Hex(media.sha256)) {
    return { ...media, integrity: invalid('tampered', 'sha256_mismatch') };
  }
  const file = contentAddressedLocalFile(media.uri, media.sha256, media.mimeType);
  if (!file) return { ...media, integrity: invalid('tampered', 'uri_not_allowlisted') };
  if (!file.exists) return { ...media, integrity: invalid('missing', 'file_missing') };
  try {
    if (file.size <= 0 || file.size > MAX_NATIVE_EVIDENCE_BYTES) {
      return { ...media, integrity: invalid('tampered', 'size_mismatch') };
    }
    const bytes = await file.bytes();
    const actualSha256 = await hashBytes(bytes);
    if (actualSha256 !== media.sha256) {
      return { ...media, integrity: invalid('tampered', 'sha256_mismatch', actualSha256) };
    }
    if (bytes.byteLength !== media.sizeBytes) {
      return { ...media, integrity: invalid('tampered', 'size_mismatch', actualSha256) };
    }
    return { ...media, integrity: verified(actualSha256) };
  } catch {
    return { ...media, integrity: invalid('tampered', 'read_failed') };
  }
};

export const verifyEvidenceFiles = async (media: MediaEvidence[]): Promise<MediaEvidence[]> =>
  Promise.all(
    media.map((item) => {
      if (item.storage === 'inline-web') {
        return Platform.OS === 'web'
          ? verifyInlineEvidence(item)
          : Promise.resolve({
              ...item,
              integrity: invalid('tampered', 'uri_not_allowlisted'),
            });
      }
      return Platform.OS === 'web'
        ? Promise.resolve({ ...item, integrity: invalid('missing', 'file_missing') })
        : verifyNativeEvidence(item);
    }),
  );

const materializeInlineEvidence = async (
  media: MediaEvidence,
  rehashLegacy: boolean,
): Promise<{ media: MediaEvidence; createdUri?: string }> => {
  const parsed = parseInlineImageDataUri(media.uri);
  if (!parsed) throw new EvidenceIntegrityError('legacy inline evidence is not valid image data');
  if (parsed.sizeBytes > MAX_NATIVE_EVIDENCE_BYTES) {
    throw new EvidenceFileTooLargeError(parsed.sizeBytes, MAX_NATIVE_EVIDENCE_BYTES);
  }
  const bytes = decodeBase64(parsed.base64);
  const actualSha256 = await hashBytes(bytes);
  if (!rehashLegacy) {
    if (parsed.mimeType !== media.mimeType.toLowerCase()) {
      throw new EvidenceIntegrityError('inline evidence MIME type changed');
    }
    if (actualSha256 !== media.sha256 || parsed.sizeBytes !== media.sizeBytes) {
      throw new EvidenceIntegrityError('inline evidence fingerprint changed');
    }
  }
  const { file, created } = await writeContentAddressedFile(
    bytes,
    actualSha256,
    parsed.mimeType,
  );
  return {
    media: {
      ...media,
      uri: file.uri,
      sha256: actualSha256,
      sizeBytes: parsed.sizeBytes,
      storage: 'app-file',
      mimeType: parsed.mimeType,
      integrity: verified(actualSha256),
    },
    ...(created ? { createdUri: file.uri } : {}),
  };
};

const prepareNativeFileEvidence = async (
  media: MediaEvidence,
  rehashLegacy: boolean,
): Promise<{ media: MediaEvidence; createdUri?: string; obsoleteUri?: string }> => {
  const source = allowlistedLocalFile(media.uri);
  if (!source) {
    return { media: { ...media, integrity: invalid('tampered', 'uri_not_allowlisted') } };
  }
  if (!source.exists) {
    return { media: { ...media, integrity: invalid('missing', 'file_missing') } };
  }
  try {
    if (source.size <= 0 || source.size > MAX_NATIVE_EVIDENCE_BYTES) {
      return { media: { ...media, integrity: invalid('tampered', 'size_mismatch') } };
    }
    const bytes = await source.bytes();
    const actualSha256 = await hashBytes(bytes);
    if (!rehashLegacy && actualSha256 !== media.sha256) {
      return {
        media: { ...media, integrity: invalid('tampered', 'sha256_mismatch', actualSha256) },
      };
    }
    if (!rehashLegacy && bytes.byteLength !== media.sizeBytes) {
      return {
        media: { ...media, integrity: invalid('tampered', 'size_mismatch', actualSha256) },
      };
    }
    const sha256 = rehashLegacy ? actualSha256 : media.sha256;
    const canonical = contentAddressedLocalFile(source.uri, sha256, media.mimeType);
    if (canonical) {
      return {
        media: {
          ...media,
          sha256,
          sizeBytes: bytes.byteLength,
          integrity: verified(actualSha256),
        },
      };
    }
    const stored = await writeContentAddressedFile(bytes, sha256, media.mimeType);
    return {
      media: {
        ...media,
        uri: stored.file.uri,
        sha256,
        sizeBytes: bytes.byteLength,
        storage: 'app-file',
        integrity: verified(actualSha256),
      },
      ...(stored.created ? { createdUri: stored.file.uri } : {}),
      ...(stored.file.uri !== source.uri ? { obsoleteUri: source.uri } : {}),
    };
  } catch {
    return { media: { ...media, integrity: invalid('tampered', 'read_failed') } };
  }
};

export const deleteAllowlistedEvidenceFiles = (uris: string[]): string[] => {
  if (Platform.OS === 'web') return [];
  const failures: string[] = [];
  for (const uri of new Set(uris)) {
    const file = allowlistedLocalFile(uri);
    if (!file) {
      failures.push(uri);
      continue;
    }
    try {
      if (file.exists) file.delete();
    } catch {
      failures.push(uri);
    }
  }
  return failures;
};

export const prepareEvidenceFilesForLoad = async (
  media: MediaEvidence[],
  options: { rehashLegacy: boolean },
): Promise<PreparedEvidenceFiles> => {
  if (Platform.OS === 'web') {
    const prepared = await Promise.all(
      media.map(async (item) => {
        if (item.storage !== 'inline-web') {
          return { ...item, integrity: invalid('missing', 'file_missing') };
        }
        const parsed = parseInlineImageDataUri(item.uri);
        if (!parsed) return { ...item, integrity: invalid('tampered', 'inline_data_invalid') };
        const actualSha256 = await hashBytes(decodeBase64(parsed.base64));
        if (!options.rehashLegacy) return verifyInlineEvidence(item);
        return {
          ...item,
          sha256: actualSha256,
          sizeBytes: parsed.sizeBytes,
          mimeType: parsed.mimeType,
          integrity: verified(actualSha256),
        };
      }),
    );
    return { media: prepared, createdFileUris: [], obsoleteFileUris: [] };
  }

  const prepared: MediaEvidence[] = [];
  const createdFileUris: string[] = [];
  const obsoleteFileUris: string[] = [];
  try {
    for (const item of media) {
      const result = item.storage === 'inline-web'
        ? await materializeInlineEvidence(item, options.rehashLegacy)
        : await prepareNativeFileEvidence(item, options.rehashLegacy);
      prepared.push(result.media);
      if (result.createdUri) createdFileUris.push(result.createdUri);
      const obsoleteUri = 'obsoleteUri' in result ? result.obsoleteUri : undefined;
      if (typeof obsoleteUri === 'string') obsoleteFileUris.push(obsoleteUri);
    }
    return { media: prepared, createdFileUris, obsoleteFileUris };
  } catch (error) {
    deleteAllowlistedEvidenceFiles(createdFileUris);
    throw error;
  }
};

export const clearEvidenceFiles = (): void => {
  if (Platform.OS === 'web') return;
  const directory = evidenceDirectory();
  if (directory.exists) directory.delete();
};
