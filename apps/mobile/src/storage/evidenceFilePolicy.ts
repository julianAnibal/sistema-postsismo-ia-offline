export const MAX_NATIVE_EVIDENCE_BYTES = 8 * 1024 * 1024;
export const MAX_WEB_INLINE_EVIDENCE_BYTES = 2_500_000;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_STEM = /^[0-9a-z][0-9a-z_-]{0,127}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface ParsedInlineImage {
  mimeType: string;
  base64: string;
  sizeBytes: number;
}

export const isSha256Hex = (value: unknown): value is string =>
  typeof value === 'string' && SHA256_HEX.test(value);

export const safeEvidenceStem = (value: string): string => {
  if (!SAFE_STEM.test(value)) throw new Error('unsafe evidence file stem');
  return value;
};

export const isSupportedImageMimeType = (value: unknown): value is string =>
  typeof value === 'string' && Object.hasOwn(MIME_EXTENSIONS, value.toLowerCase());

export const estimateBase64Bytes = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

export const safeImageExtension = (fileName: string | null | undefined, mimeType: string): string => {
  const candidate = fileName?.match(/\.[a-zA-Z0-9]{2,5}$/)?.[0]?.toLowerCase();
  if (candidate && ['.heic', '.heif', '.jpeg', '.jpg', '.png', '.webp'].includes(candidate)) {
    return candidate === '.jpeg' ? '.jpg' : candidate;
  }
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? '.jpg';
};

export const contentAddressedImageName = (sha256: string, mimeType: string): string => {
  if (!isSha256Hex(sha256)) throw new Error('invalid SHA-256 fingerprint');
  if (!isSupportedImageMimeType(mimeType)) throw new Error('unsupported evidence MIME type');
  return `${safeEvidenceStem(sha256)}${MIME_EXTENSIONS[mimeType.toLowerCase()]}`;
};

export const digestToHex = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');

export const legacyInlineSize = (uri: string): number => {
  const marker = ';base64,';
  const markerIndex = uri.indexOf(marker);
  return markerIndex >= 0 ? estimateBase64Bytes(uri.slice(markerIndex + marker.length)) : 0;
};

export const parseInlineImageDataUri = (uri: string): ParsedInlineImage | null => {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(uri);
  if (!match || !isSupportedImageMimeType(match[1])) return null;
  const base64 = match[2];
  if (!base64 || base64.length % 4 !== 0 || !BASE64.test(base64)) return null;
  return {
    mimeType: match[1].toLowerCase(),
    base64,
    sizeBytes: estimateBase64Bytes(base64),
  };
};
