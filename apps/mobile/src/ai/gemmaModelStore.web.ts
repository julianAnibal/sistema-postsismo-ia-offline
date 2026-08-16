import { createSHA256 } from 'hash-wasm';

import {
  GEMMA_E2B_MODEL,
  GemmaInstallMetadata,
  isValidGemmaInstallMetadata,
} from './gemmaModel';
import {
  GemmaAvailability,
  GemmaProgressListener,
} from './gemmaRuntime.types';

const MODEL_DIRECTORY = '1000-ojos-ai';
const EXTRA_STORAGE_BYTES = 256 * 1024 * 1024;

const webSupportReason = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'Gemma web solo está disponible dentro de un navegador.';
  }
  if (!window.isSecureContext) {
    return 'Gemma requiere un origen HTTPS seguro.';
  }
  if (!('gpu' in navigator)) {
    return 'Este navegador no expone WebGPU, requerido por LiteRT-LM.';
  }
  if (!navigator.storage || !('getDirectory' in navigator.storage)) {
    return 'Este navegador no ofrece almacenamiento OPFS para el paquete offline.';
  }
  return null;
};

const getDirectory = async (create: boolean) => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(MODEL_DIRECTORY, { create });
};

const missingEntry = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotFoundError';

const readMetadata = async (directory: FileSystemDirectoryHandle) => {
  try {
    const handle = await directory.getFileHandle(GEMMA_E2B_MODEL.metadataFileName);
    const file = await handle.getFile();
    return JSON.parse(await file.text()) as unknown;
  } catch (error) {
    if (missingEntry(error) || error instanceof SyntaxError) return null;
    throw error;
  }
};

const removeEntryIfPresent = async (
  directory: FileSystemDirectoryHandle,
  name: string,
) => {
  try {
    await directory.removeEntry(name);
  } catch (error) {
    if (!missingEntry(error)) throw error;
  }
};

const storageStatus = async () => {
  const estimate = await navigator.storage.estimate();
  const persistent = navigator.storage.persisted
    ? await navigator.storage.persisted()
    : null;
  return {
    quotaBytes: estimate.quota,
    usageBytes: estimate.usage,
    persistent,
  };
};

export const inspectGemma = async (): Promise<GemmaAvailability> => {
  const reason = webSupportReason();
  if (reason) {
    return { supported: false, installed: false, persistent: null, reason };
  }

  const storage = await storageStatus();
  try {
    const directory = await getDirectory(false);
    const modelHandle = await directory.getFileHandle(GEMMA_E2B_MODEL.storageFileName);
    const modelFile = await modelHandle.getFile();
    const metadata = await readMetadata(directory);
    return {
      supported: true,
      installed: isValidGemmaInstallMetadata(metadata, modelFile),
      ...storage,
    };
  } catch (error) {
    if (!missingEntry(error)) throw error;
    return { supported: true, installed: false, ...storage };
  }
};

const requireStorageHeadroom = async () => {
  const estimate = await navigator.storage.estimate();
  if (typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number') return;
  const free = estimate.quota - estimate.usage;
  const required = GEMMA_E2B_MODEL.sizeBytes + EXTRA_STORAGE_BYTES;
  if (free < required) {
    throw new Error(
      `Espacio insuficiente para Gemma: se requieren ${(required / 1024 ** 3).toFixed(2)} GiB libres dentro de la cuota del navegador.`,
    );
  }
};

const writeMetadata = async (
  directory: FileSystemDirectoryHandle,
  metadata: GemmaInstallMetadata,
) => {
  const handle = await directory.getFileHandle(GEMMA_E2B_MODEL.metadataFileName, {
    create: true,
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(metadata));
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
};

const installStream = async ({
  stream,
  source,
  onProgress,
}: {
  stream: ReadableStream<Uint8Array>;
  source: GemmaInstallMetadata['source'];
  onProgress: GemmaProgressListener;
}) => {
  await requireStorageHeadroom();
  if (navigator.storage.persist) await navigator.storage.persist();

  const directory = await getDirectory(true);
  await removeEntryIfPresent(directory, GEMMA_E2B_MODEL.metadataFileName);
  const modelHandle = await directory.getFileHandle(GEMMA_E2B_MODEL.storageFileName, {
    create: true,
  });
  const writable = await modelHandle.createWritable({ keepExistingData: false });
  const hasher = await createSHA256();
  const reader = stream.getReader();
  let completedBytes = 0;
  let closed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      completedBytes += value.byteLength;
      if (completedBytes > GEMMA_E2B_MODEL.sizeBytes) {
        throw new Error('El archivo supera el tamaño exacto del paquete Gemma fijado.');
      }
      hasher.update(value);
      const writableChunk = new Uint8Array(value.byteLength);
      writableChunk.set(value);
      await writable.write(writableChunk);
      onProgress({
        phase: source === 'network' ? 'downloading' : 'importing',
        completedBytes,
        totalBytes: GEMMA_E2B_MODEL.sizeBytes,
      });
    }

    await writable.close();
    closed = true;
    onProgress({
      phase: 'verifying',
      completedBytes,
      totalBytes: GEMMA_E2B_MODEL.sizeBytes,
    });

    if (completedBytes !== GEMMA_E2B_MODEL.sizeBytes) {
      throw new Error('El archivo Gemma está incompleto.');
    }
    const sha256 = hasher.digest('hex');
    if (sha256 !== GEMMA_E2B_MODEL.sha256) {
      throw new Error('La huella SHA-256 del paquete Gemma no coincide con la versión fijada.');
    }

    const modelFile = await modelHandle.getFile();
    await writeMetadata(directory, {
      schemaVersion: 1,
      modelId: GEMMA_E2B_MODEL.id,
      revision: GEMMA_E2B_MODEL.revision,
      fileName: GEMMA_E2B_MODEL.fileName,
      sizeBytes: GEMMA_E2B_MODEL.sizeBytes,
      sha256: GEMMA_E2B_MODEL.sha256,
      modelLastModified: modelFile.lastModified,
      installedAt: new Date().toISOString(),
      source,
    });
  } catch (error) {
    reader.cancel().catch(() => undefined);
    if (!closed) await writable.abort().catch(() => undefined);
    await removeEntryIfPresent(directory, GEMMA_E2B_MODEL.storageFileName);
    await removeEntryIfPresent(directory, GEMMA_E2B_MODEL.metadataFileName);
    throw error;
  }
};

export const installGemmaFromNetwork = async (
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability> => {
  const current = await inspectGemma();
  if (!current.supported) throw new Error(current.reason);
  if (current.installed) return current;

  const response = await fetch(GEMMA_E2B_MODEL.downloadUrl, { cache: 'no-store' });
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar Gemma (${response.status}).`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength !== GEMMA_E2B_MODEL.sizeBytes) {
    throw new Error('El servidor devolvió un tamaño distinto al paquete Gemma fijado.');
  }

  await installStream({ stream: response.body, source: 'network', onProgress });
  return inspectGemma();
};

const chooseLocalModelFile = () =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.litertlm,application/octet-stream';
    input.style.display = 'none';
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });

export const installGemmaFromPicker = async (
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability> => {
  const current = await inspectGemma();
  if (!current.supported) throw new Error(current.reason);
  if (current.installed) return current;

  const file = await chooseLocalModelFile();
  if (!file) return current;
  if (file.size !== GEMMA_E2B_MODEL.sizeBytes) {
    throw new Error('El archivo seleccionado no tiene el tamaño exacto de Gemma 4 E2B web.');
  }
  await installStream({ stream: file.stream(), source: 'local-file', onProgress });
  return inspectGemma();
};

export const getProvisionedGemmaFile = async () => {
  const availability = await inspectGemma();
  if (!availability.supported) throw new Error(availability.reason);
  if (!availability.installed) {
    throw new Error('Gemma 4 E2B todavía no está instalado o su verificación no es válida.');
  }
  const directory = await getDirectory(false);
  const handle = await directory.getFileHandle(GEMMA_E2B_MODEL.storageFileName);
  return handle.getFile();
};
