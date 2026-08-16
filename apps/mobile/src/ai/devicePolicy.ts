import { LocalModelTask, ModelPackManifest } from './contracts';

const GIB = 1024 ** 3;
const MIN_VISION_RAM = 3 * GIB;
const MIN_VISION_STORAGE = 768 * 1024 ** 2;
const MIN_LANGUAGE_RAM = 6 * GIB;
const MIN_LANGUAGE_STORAGE = 4 * GIB;
const MAX_MODEL_MEMORY_SHARE = 0.3;
const MAX_APP_MEMORY_SHARE = 0.7;

export interface DeviceCapabilities {
  platform: string;
  isPhysicalDevice: boolean;
  totalMemoryBytes: number | null;
  maxAppMemoryBytes: number | null;
  availableStorageBytes: number | null;
  cpuArchitectures: string[];
}

export type ExecutionTier = 'deterministic' | 'compact-vision-candidate' | 'language-candidate';

export interface ModelCompatibility {
  compatible: boolean;
  reasons: string[];
}

export interface QualityRequirement {
  metric: string;
  minimumValue: number;
}

const normalizeArchitecture = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const isPositiveSafeInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

const isSafeRelativePackagePath = (value: unknown) => {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.replace(/\\/g, '/');
  return !normalized.startsWith('/') &&
    !normalized.split('/').includes('..');
};

export const recommendExecutionTier = (device: DeviceCapabilities): ExecutionTier => {
  if (!device.isPhysicalDevice || device.platform === 'web') return 'deterministic';
  if (device.totalMemoryBytes === null || device.availableStorageBytes === null) {
    return 'deterministic';
  }
  if (
    device.totalMemoryBytes >= MIN_LANGUAGE_RAM &&
    device.availableStorageBytes >= MIN_LANGUAGE_STORAGE
  ) {
    return 'language-candidate';
  }
  if (
    device.totalMemoryBytes >= MIN_VISION_RAM &&
    device.availableStorageBytes >= MIN_VISION_STORAGE
  ) {
    return 'compact-vision-candidate';
  }
  return 'deterministic';
};

export const assessModelCompatibility = (
  manifest: ModelPackManifest,
  device: DeviceCapabilities,
): ModelCompatibility => {
  const reasons: string[] = [];
  if (manifest.status !== 'released' || !manifest.released) reasons.push('model_not_released');
  if (
    (manifest.released && manifest.status !== 'released') ||
    (!manifest.released && manifest.status !== 'unreleased')
  ) {
    reasons.push('release_status_inconsistent');
  }
  if (manifest.manifestVersion !== 1) reasons.push('manifest_version_unsupported');
  if (!isNonEmptyString(manifest.id) || !isNonEmptyString(manifest.version)) {
    reasons.push('invalid_model_identity');
  }
  if (!['onnx-runtime-mobile', 'litert-lm'].includes(String(manifest.runtime))) {
    reasons.push('runtime_unsupported');
  }
  if (manifest.task === null) {
    reasons.push('task_missing');
  } else if (![
    'capture-quality',
    'visible-condition-segmentation',
    'language-drafting',
  ].includes(String(manifest.task))) {
    reasons.push('task_unsupported');
  }
  if (!manifest.evaluation) reasons.push('evaluation_missing');
  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) reasons.push('invalid_sha256');
  if (!isPositiveSafeInteger(manifest.sizeBytes)) reasons.push('invalid_package_size');
  if (
    !isPositiveSafeInteger(manifest.minimumMemoryBytes) ||
    !isPositiveSafeInteger(manifest.estimatedPeakMemoryBytes) ||
    !isPositiveSafeInteger(manifest.minimumFreeStorageBytes) ||
    manifest.estimatedPeakMemoryBytes > manifest.minimumMemoryBytes ||
    manifest.minimumFreeStorageBytes < manifest.sizeBytes
  ) {
    reasons.push('invalid_resource_budget');
  }
  if (
    manifest.evaluation &&
    (typeof manifest.evaluation !== 'object' ||
      !isNonEmptyString(manifest.evaluation.metric) ||
      !Number.isFinite(manifest.evaluation.value) ||
      !isNonEmptyString(manifest.evaluation.datasetReleaseId) ||
      !/^[a-f0-9]{64}$/i.test(manifest.evaluation.reportSha256) ||
      !isSafeRelativePackagePath(manifest.evaluation.reportPath))
  ) {
    reasons.push('invalid_evaluation_evidence');
  }
  if (!isSafeRelativePackagePath(manifest.licenseNoticePath)) reasons.push('license_notice_missing');
  if (!device.isPhysicalDevice || device.platform === 'web') reasons.push('native_runtime_unavailable');

  if (device.totalMemoryBytes === null) {
    reasons.push('memory_unknown');
  } else {
    if (device.totalMemoryBytes < manifest.minimumMemoryBytes) reasons.push('insufficient_total_memory');
    if (manifest.estimatedPeakMemoryBytes > device.totalMemoryBytes * MAX_MODEL_MEMORY_SHARE) {
      reasons.push('insufficient_execution_headroom');
    }
  }

  if (
    device.maxAppMemoryBytes !== null &&
    manifest.estimatedPeakMemoryBytes > device.maxAppMemoryBytes * MAX_APP_MEMORY_SHARE
  ) {
    reasons.push('insufficient_app_memory_headroom');
  }

  if (device.availableStorageBytes === null) {
    reasons.push('storage_unknown');
  } else if (
    device.availableStorageBytes < manifest.minimumFreeStorageBytes
  ) {
    reasons.push('insufficient_storage');
  }

  const packageArchitectures = Array.isArray(manifest.supportedCpuArchitectures)
    ? manifest.supportedCpuArchitectures.filter(
        (architecture): architecture is string => typeof architecture === 'string',
      )
    : [];
  if (
    !Array.isArray(manifest.supportedCpuArchitectures) ||
    packageArchitectures.length !== manifest.supportedCpuArchitectures.length
  ) {
    reasons.push('invalid_cpu_architectures');
  }
  if (packageArchitectures.length > 0) {
    const deviceArchitectures = new Set(device.cpuArchitectures.map(normalizeArchitecture));
    if (deviceArchitectures.size === 0) {
      reasons.push('cpu_architecture_unknown');
    } else if (
      !packageArchitectures.some((value) =>
        deviceArchitectures.has(normalizeArchitecture(value)),
      )
    ) {
      reasons.push('cpu_architecture_unsupported');
    }
  }

  return { compatible: reasons.length === 0, reasons };
};

export const selectEfficientModel = (
  manifests: ModelPackManifest[],
  device: DeviceCapabilities,
  task: LocalModelTask,
  quality: QualityRequirement,
): ModelPackManifest | null =>
  manifests
    .filter((manifest) => manifest.task === task)
    .filter((manifest) => assessModelCompatibility(manifest, device).compatible)
    .filter(
      (manifest) =>
        manifest.evaluation?.metric === quality.metric &&
        manifest.evaluation.value >= quality.minimumValue,
    )
    .sort(
      (left, right) =>
        left.estimatedPeakMemoryBytes - right.estimatedPeakMemoryBytes ||
        left.sizeBytes - right.sizeBytes ||
        (right.evaluation?.value ?? 0) - (left.evaluation?.value ?? 0),
    )[0] ?? null;

export const formatDeviceBytes = (value: number | null): string =>
  value === null
    ? 'desconocido'
    : value >= GIB
      ? `${(value / GIB).toFixed(1)} GB`
      : value >= 1024 ** 2
        ? `${(value / 1024 ** 2).toFixed(1)} MB`
        : value >= 1024
          ? `${(value / 1024).toFixed(1)} KB`
          : `${value} B`;
