import {
  AppState,
  CaptureQualityMeasurement,
  EvidenceSensorMetadata,
  MediaEvidence,
} from '../domain/types';
import { assessCapturePreflight } from '../domain/capturePreflight';
import {
  isSha256Hex,
  isSupportedImageMimeType,
  legacyInlineSize,
  MAX_NATIVE_EVIDENCE_BYTES,
  parseInlineImageDataUri,
} from './evidenceFilePolicy';

const unavailableSensorMetadata = (recordedAt: string): EvidenceSensorMetadata => ({
  recordedAt,
  location: { status: 'unavailable' },
  motion: { status: 'unavailable' },
  device: {
    manufacturer: null,
    modelName: null,
    osName: null,
    osVersion: null,
    isDevice: false,
    totalMemoryBytes: null,
    supportedCpuArchitectures: [],
  },
  exif: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const sensorStatuses = new Set(['captured', 'denied', 'unavailable', 'error']);
const qualitySignals = new Set(['nearly_all_dark', 'nearly_all_bright', 'nearly_uniform']);

const unmeasuredCaptureQuality = (checkedAt: string): CaptureQualityMeasurement => ({
  schemaVersion: 1,
  checkedAt,
  modelUsed: false,
  networkRequired: false,
  releaseStatus: 'shadow',
  scope: 'extreme-pixel-proxy-v1',
  status: 'unsupported',
  reason: 'legacy_not_measured',
});

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const numberInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  finiteNumber(value) && value >= minimum && value <= maximum;

const integerInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isInteger(value) && numberInRange(value, minimum, maximum);

const normalizeCaptureQuality = (
  value: unknown,
  checkedAt: string,
): CaptureQualityMeasurement => {
  const fallback = unmeasuredCaptureQuality(checkedAt);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.checkedAt !== 'string' ||
    value.modelUsed !== false ||
    value.networkRequired !== false ||
    value.releaseStatus !== 'shadow' ||
    value.scope !== 'extreme-pixel-proxy-v1'
  ) {
    return fallback;
  }
  if (value.status === 'unsupported' || value.status === 'error') {
    return [
      'web_memory_guard',
      'native_proxy_unavailable',
      'input_rejected',
      'out_of_memory',
      'proxy_failed',
      'legacy_not_measured',
    ].includes(String(value.reason))
      ? (value as unknown as CaptureQualityMeasurement)
      : fallback;
  }
  if (value.status !== 'measured' || !isRecord(value.proxy) || !isRecord(value.metrics)) {
    return fallback;
  }
  const width = value.proxy.width;
  const height = value.proxy.height;
  const encodedBytes = value.proxy.encodedBytes;
  const decodedBytes = value.proxy.decodedBytes;
  const accountedBufferBytes = value.proxy.accountedBufferBytes;
  const p01Luminance = value.metrics.p01Luminance;
  const p99Luminance = value.metrics.p99Luminance;
  const signalIds = value.signalIds;
  const minimumAccountedBuffers = Number(encodedBytes) + Number(decodedBytes) * 3;
  const maximumAccountedBuffers = Number(encodedBytes) + Number(decodedBytes) * 2 + 192 * 192 * 4;
  if (
    !integerInRange(width, 3, 96) ||
    !integerInRange(height, 3, 96) ||
    !integerInRange(encodedBytes, 1, 512 * 1024) ||
    !integerInRange(decodedBytes, 1, 96 * 96 * 4) ||
    decodedBytes !== width * height * 4 ||
    !integerInRange(accountedBufferBytes, 1, 512 * 1024 + 96 * 96 * 8 + 192 * 192 * 4) ||
    accountedBufferBytes < minimumAccountedBuffers ||
    accountedBufferBytes > maximumAccountedBuffers ||
    !numberInRange(value.metrics.meanLuminance, 0, 255) ||
    !numberInRange(value.metrics.luminanceStandardDeviation, 0, 255) ||
    !numberInRange(value.metrics.lowClipFraction, 0, 1) ||
    !numberInRange(value.metrics.highClipFraction, 0, 1) ||
    !numberInRange(p01Luminance, 0, 255) ||
    !numberInRange(p99Luminance, 0, 255) ||
    p01Luminance > p99Luminance ||
    !numberInRange(value.metrics.entropyBits, 0, 8) ||
    !numberInRange(value.metrics.laplacianVariance, 0, 1_040_400) ||
    !numberInRange(value.processingMilliseconds, 0, 60_000) ||
    !Array.isArray(signalIds) ||
    signalIds.length > qualitySignals.size ||
    new Set(signalIds).size !== signalIds.length ||
    !signalIds.every((signal) => qualitySignals.has(String(signal)))
  ) {
    return fallback;
  }
  return value as unknown as CaptureQualityMeasurement;
};

const validSensorRecord = <T>(
  value: unknown,
  fallback: T,
): T =>
  isRecord(value) && sensorStatuses.has(String(value.status))
    ? (value as unknown as T)
    : fallback;

const normalizeMedia = (value: unknown, sourceSchemaVersion: 1 | 2): MediaEvidence | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.inspectionId !== 'string' ||
    typeof value.uri !== 'string' ||
    typeof value.sha256 !== 'string' ||
    !isSupportedImageMimeType(value.mimeType) ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number' ||
    typeof value.capturedAt !== 'string' ||
    !['camera', 'library'].includes(String(value.provenance)) ||
    value.immutable !== true
  ) {
    return null;
  }

  if (sourceSchemaVersion === 2 && !isSha256Hex(value.sha256)) return null;

  const storage =
    value.storage === 'app-file' || value.storage === 'inline-web'
      ? value.storage
      : value.uri.startsWith('data:')
        ? 'inline-web'
        : 'app-file';
  if (storage === 'inline-web' && !parseInlineImageDataUri(value.uri)) return null;
  if (storage === 'app-file' && value.uri.startsWith('data:')) return null;

  const fallback = unavailableSensorMetadata(value.capturedAt);
  const existingSensors = isRecord(value.sensorMetadata)
    ? (value.sensorMetadata as unknown as EvidenceSensorMetadata)
    : fallback;
  const existingDevice = isRecord(existingSensors.device) ? existingSensors.device : fallback.device;
  const sizeBytes =
    typeof value.sizeBytes === 'number' && Number.isInteger(value.sizeBytes) && value.sizeBytes > 0
      ? value.sizeBytes
      : legacyInlineSize(value.uri);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_NATIVE_EVIDENCE_BYTES) {
    return null;
  }

  return {
    ...(value as unknown as MediaEvidence),
    sha256: sourceSchemaVersion === 1 ? '0'.repeat(64) : value.sha256,
    sizeBytes,
    storage,
    // The check is cheap and deterministic. Recompute it at the trust boundary
    // instead of accepting a stale or malformed persisted result.
    capturePreflight: assessCapturePreflight(
      value.width,
      value.height,
      sizeBytes,
      value.capturedAt,
    ),
    captureQuality: normalizeCaptureQuality(value.captureQuality, value.capturedAt),
    provenance: value.provenance as MediaEvidence['provenance'],
    sensorMetadata: {
      ...fallback,
      ...existingSensors,
      location: validSensorRecord(existingSensors.location, fallback.location),
      motion: validSensorRecord(existingSensors.motion, fallback.motion),
      device: {
        ...fallback.device,
        ...existingDevice,
        manufacturer: typeof existingDevice.manufacturer === 'string' ? existingDevice.manufacturer : null,
        modelName: typeof existingDevice.modelName === 'string' ? existingDevice.modelName : null,
        osName: typeof existingDevice.osName === 'string' ? existingDevice.osName : null,
        osVersion: typeof existingDevice.osVersion === 'string' ? existingDevice.osVersion : null,
        isDevice: existingDevice.isDevice === true,
        totalMemoryBytes:
          typeof existingDevice.totalMemoryBytes === 'number' &&
          Number.isFinite(existingDevice.totalMemoryBytes) &&
          existingDevice.totalMemoryBytes >= 0
            ? existingDevice.totalMemoryBytes
            : null,
        supportedCpuArchitectures: Array.isArray(existingDevice.supportedCpuArchitectures)
          ? existingDevice.supportedCpuArchitectures.filter(
              (architecture): architecture is string => typeof architecture === 'string',
            )
          : [],
      },
      exif: isRecord(existingSensors.exif) ? existingSensors.exif : null,
    },
    integrity: {
      status: 'unverified',
      checkedAt: value.capturedAt,
      reason: 'not_checked',
    },
  };
};

export const migrateFieldState = (value: unknown): AppState | null => {
  if (!isRecord(value) || ![1, 2].includes(Number(value.schemaVersion))) return null;
  const sourceSchemaVersion = Number(value.schemaVersion) as 1 | 2;
  if (
    typeof value.operationName !== 'string' ||
    typeof value.deviceAlias !== 'string' ||
    !Array.isArray(value.infrastructures) ||
    !Array.isArray(value.inspections) ||
    !Array.isArray(value.media) ||
    !Array.isArray(value.annotations) ||
    !Array.isArray(value.outbox)
  ) {
    return null;
  }

  const media = value.media.map((item) => normalizeMedia(item, sourceSchemaVersion));
  if (media.some((item) => item === null)) return null;

  return {
    ...(value as unknown as AppState),
    schemaVersion: 2,
    media: media as MediaEvidence[],
    modelAnalyses: Array.isArray(value.modelAnalyses) ? value.modelAnalyses : [],
  };
};
