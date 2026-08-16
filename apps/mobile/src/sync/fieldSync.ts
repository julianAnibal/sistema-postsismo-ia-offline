import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type {
  AppState,
  EvidenceAnnotation,
  Infrastructure,
  Inspection,
  MediaEvidence,
  OutboxAcknowledgement,
} from '../domain/types';
import { digestToHex, isSupportedImageMimeType } from '../storage/evidenceFilePolicy';
import { verifyEvidenceFiles } from '../storage/evidenceFiles';

const ENDPOINT_KEY = '1000-ojos.sync.endpoint';
const TOKEN_KEY = '1000-ojos.sync.token';
const INSTALLATION_KEY = '1000-ojos.installation.id';
const MAX_MEDIA_BYTES = 15_000_000;
const FIELD_SYNC_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface SyncSettings {
  endpoint: string;
  token: string;
}

interface PreparedMediaUpload {
  media: MediaEvidence;
  body: Blob;
}

export interface FieldSyncResult {
  batchId: string;
  acknowledgedOutboxItems: OutboxAcknowledgement[];
}

const webSessionGet = (key: string) => {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const webSessionSet = (key: string, value: string) => {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    throw new Error('El navegador bloqueó el almacenamiento temporal de la configuración.');
  }
};

const getSecret = async (key: string) =>
  Platform.OS === 'web'
    ? webSessionGet(key)
    : SecureStore.getItemAsync(key, secureOptions);

const setSecret = async (key: string, value: string) => {
  if (Platform.OS === 'web') webSessionSet(key, value);
  else await SecureStore.setItemAsync(key, value, secureOptions);
};

const normalizeEndpoint = (url: string) => url.trim().replace(/\/+$/, '');

const isValidEndpoint = (url: string) =>
  /^https:\/\//.test(url) || /^http:\/\/localhost(?::\d+)?$/.test(url);

export const loadSyncSettings = async (): Promise<SyncSettings> => {
  const savedEndpoint = await getSecret(ENDPOINT_KEY);
  const token = (await getSecret(TOKEN_KEY)) ?? '';
  if (savedEndpoint) return { endpoint: normalizeEndpoint(savedEndpoint), token };

  const buildTimeEndpoint = process.env.EXPO_PUBLIC_FIELD_API_URL;
  if (!buildTimeEndpoint) return { endpoint: '', token };
  const endpoint = normalizeEndpoint(buildTimeEndpoint);
  if (!isValidEndpoint(endpoint)) {
    throw new Error(
      'EXPO_PUBLIC_FIELD_API_URL debe usar HTTPS o localhost durante desarrollo.',
    );
  }
  return { endpoint, token };
};

export const saveSyncSettings = async (endpoint: string, token: string) => {
  const normalized = normalizeEndpoint(endpoint);
  if (!isValidEndpoint(normalized)) throw new Error('La dirección debe usar HTTPS.');
  if (!token.trim()) throw new Error('Ingrese el token operativo.');
  await setSecret(ENDPOINT_KEY, normalized);
  await setSecret(TOKEN_KEY, token.trim());
};

const installationId = async () => {
  if (Platform.OS !== 'web') {
    let current = await SecureStore.getItemAsync(INSTALLATION_KEY, secureOptions);
    if (!current) {
      current = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_KEY, current, secureOptions);
    }
    return current;
  }

  try {
    let current = globalThis.localStorage?.getItem(INSTALLATION_KEY) ?? null;
    if (!current) {
      current = Crypto.randomUUID();
      globalThis.localStorage?.setItem(INSTALLATION_KEY, current);
    }
    return current;
  } catch {
    throw new Error('El navegador bloqueó la identidad local necesaria para reintentos seguros.');
  }
};

const installationHash = async () =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, await installationId());

const byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((left, right) => left.id.localeCompare(right.id));

const queuedEntityIds = (state: AppState, entityType: 'inspection' | 'media' | 'annotation') =>
  new Set(
    state.outbox
      .filter((item) => item.entityType === entityType)
      .map((item) => item.entityId),
  );

const mapInfrastructure = (item: Infrastructure) => ({
  id: item.id,
  code: item.code,
  name: item.name,
  type: item.type,
  sector: item.sector,
  latitude: item.latitude,
  longitude: item.longitude,
  coordinatesAreSynthetic: item.coordinatesAreSynthetic,
});

const mapInspection = (item: Inspection) => ({
  id: item.id,
  infrastructureId: item.infrastructureId,
  status: item.status,
  access: item.access,
  observation: item.observation,
  damageLevel: item.damageLevel,
  element: item.element,
  condition: item.condition,
  observability: item.observability,
  viewType: item.viewType,
  notes: item.notes,
  estimatedOccupants: item.estimatedOccupants,
  peopleNeedingSupport: item.peopleNeedingSupport,
  needs: item.needs,
  mediaIds: item.mediaIds,
  updatedAt: item.updatedAt,
  ...(item.reviewedAt ? { reviewedAt: item.reviewedAt } : {}),
});

export const mapMediaForFieldSync = (item: MediaEvidence) => ({
  id: item.id,
  inspectionId: item.inspectionId,
  sha256: item.sha256,
  mimeType: item.mimeType,
  width: item.width,
  height: item.height,
  capturedAt: item.capturedAt,
  provenance: item.provenance,
  sensorMetadata: {
    recordedAt: item.sensorMetadata.recordedAt,
    location: item.sensorMetadata.location,
    motion: item.sensorMetadata.motion,
    device: {
      manufacturer: item.sensorMetadata.device.manufacturer,
      modelName: item.sensorMetadata.device.modelName,
      osName: item.sensorMetadata.device.osName,
      osVersion: item.sensorMetadata.device.osVersion,
      isDevice: item.sensorMetadata.device.isDevice,
    },
    exif: item.sensorMetadata.exif,
  },
});

const mapAnnotation = (item: EvidenceAnnotation) => ({
  id: item.id,
  mediaId: item.mediaId,
  source: item.source,
  element: item.element,
  condition: item.condition,
  observability: item.observability,
  viewType: item.viewType,
  createdAt: item.createdAt,
});

const pendingContractData = (state: AppState, media = state.media) => {
  const inspectionIds = queuedEntityIds(state, 'inspection');
  const mediaIds = queuedEntityIds(state, 'media');
  const annotationIds = queuedEntityIds(state, 'annotation');
  return {
    infrastructures: byId(state.infrastructures).map(mapInfrastructure),
    inspections: byId(state.inspections.filter((item) => inspectionIds.has(item.id))).map(mapInspection),
    media: byId(media.filter((item) => mediaIds.has(item.id))).map(mapMediaForFieldSync),
    annotations: byId(state.annotations.filter((item) => annotationIds.has(item.id))).map(mapAnnotation),
  };
};

export const buildBatchId = async (state: AppState, deviceIdHash = '') => {
  const fingerprint = JSON.stringify({
    operationName: state.operationName,
    deviceIdHash,
    outbox: [...state.outbox]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, entityType, entityId, operation, createdAt }) => ({
        id,
        entityType,
        entityId,
        operation,
        createdAt,
      })),
    payload: pendingContractData(state),
  });
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fingerprint,
  );
  return `batch-${digest.slice(0, 32)}`;
};

export const buildBatchCreatedAt = (state: AppState) =>
  [...state.outbox]
    .map((item) => item.createdAt)
    .sort((left, right) => left.localeCompare(right))[0] ?? new Date().toISOString();

const operationId = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128) || 'operacion-campo';

const responsePayload = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const responseError = (payload: Record<string, unknown>, fallback: string) => {
  const error = payload.error;
  if (typeof error !== 'object' || error === null) return fallback;
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message : fallback;
};

const prepareMediaUpload = async (media: MediaEvidence): Promise<PreparedMediaUpload> => {
  if (!isSupportedImageMimeType(media.mimeType) || !FIELD_SYNC_MIME_TYPES.has(media.mimeType)) {
    throw new Error(
      `La evidencia ${media.id} usa ${media.mimeType}, un formato que este servidor todavía no admite.`,
    );
  }
  const body = media.storage === 'app-file'
    ? new Blob([await new File(media.uri).bytes()], { type: media.mimeType })
    : await fetch(media.uri).then((source) => source.blob());
  if (body.size <= 0 || body.size > MAX_MEDIA_BYTES || body.size !== media.sizeBytes) {
    throw new Error(`La evidencia ${media.id} cambió de tamaño antes del envío.`);
  }
  const actualSha256 = digestToHex(
    await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      new Uint8Array(await body.arrayBuffer()),
    ),
  );
  if (actualSha256 !== media.sha256) {
    throw new Error(`La evidencia ${media.id} cambió después de la reverificación.`);
  }
  return { media, body };
};

const prepareQueuedMedia = async (state: AppState): Promise<PreparedMediaUpload[]> => {
  const mediaIds = queuedEntityIds(state, 'media');
  const queued = byId(state.media.filter((item) => mediaIds.has(item.id)));
  const verified = await verifyEvidenceFiles(queued);
  const unsafe = verified.find((item) => item.integrity.status !== 'verified');
  if (unsafe) {
    const label = unsafe.integrity.status === 'missing' ? 'no está disponible' : 'no coincide con su huella';
    throw new Error(`Sincronización bloqueada: la evidencia ${unsafe.id} ${label}.`);
  }
  return Promise.all(verified.map(prepareMediaUpload));
};

const uploadMedia = async (
  endpoint: string,
  token: string,
  batchId: string,
  operation: string,
  upload: PreparedMediaUpload,
) => {
  const response = await fetch(`${endpoint}/api/internal/v1/field-media`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': upload.media.mimeType,
      'x-operation-id': operation,
      'x-batch-id': batchId,
      'x-media-id': upload.media.id,
      'x-content-sha256': upload.media.sha256,
    },
    body: upload.body,
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(responseError(payload, `Falló la foto ${upload.media.id}.`));
};

export const synchronizeFieldState = async (state: AppState): Promise<FieldSyncResult> => {
  if (state.outbox.length === 0) throw new Error('No hay cambios pendientes.');
  const connection = await NetInfo.fetch();
  if (connection.isConnected === false) {
    throw new Error('Sin conexión. La cola permanece en el teléfono.');
  }
  const { endpoint, token } = await loadSyncSettings();
  if (!endpoint || !token) throw new Error('Configure el servidor y el token operativo.');

  // Read, rehash, and retain the exact upload bodies before the server accepts the batch.
  const uploads = await prepareQueuedMedia(state);
  const verifiedMedia = uploads.map((item) => item.media);
  const deviceIdHash = await installationHash();
  const batchId = await buildBatchId(state, deviceIdHash);
  const operation = operationId(state.operationName);
  const contract = pendingContractData(state, verifiedMedia);
  const response = await fetch(`${endpoint}/api/internal/v1/field-sync`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      batchId,
      operationId: operation,
      deviceIdHash,
      createdAt: buildBatchCreatedAt(state),
      ...contract,
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(responseError(payload, 'El servidor rechazó el lote.'));

  // The backend requires the idempotent batch record before any binary object.
  for (const upload of uploads) {
    await uploadMedia(endpoint, token, batchId, operation, upload);
  }

  return {
    batchId,
    acknowledgedOutboxItems: state.outbox.map((item) => ({
      outboxId: item.id,
      entityId: item.entityId,
      createdAt: item.createdAt,
    })),
  };
};
