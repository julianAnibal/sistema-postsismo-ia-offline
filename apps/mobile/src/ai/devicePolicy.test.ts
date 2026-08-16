import { describe, expect, it } from 'vitest';

import { ModelPackManifest } from './contracts';
import {
  assessModelCompatibility,
  DeviceCapabilities,
  recommendExecutionTier,
  selectEfficientModel,
} from './devicePolicy';

const GIB = 1024 ** 3;

const device = (memoryGiB: number, storageGiB: number): DeviceCapabilities => ({
  platform: 'android',
  isPhysicalDevice: true,
  totalMemoryBytes: memoryGiB * GIB,
  maxAppMemoryBytes: 512 * 1024 ** 2,
  availableStorageBytes: storageGiB * GIB,
  cpuArchitectures: ['arm64-v8a'],
});

const manifest = (overrides: Partial<ModelPackManifest> = {}): ModelPackManifest => ({
  manifestVersion: 1,
  id: 'visible-condition-small',
  version: '1.0.0',
  runtime: 'onnx-runtime-mobile',
  task: 'visible-condition-segmentation',
  sha256: 'a'.repeat(64),
  sizeBytes: 24 * 1024 ** 2,
  minimumMemoryBytes: 3 * GIB,
  estimatedPeakMemoryBytes: 320 * 1024 ** 2,
  minimumFreeStorageBytes: 256 * 1024 ** 2,
  supportedCpuArchitectures: ['arm64-v8a'],
  released: true,
  status: 'released',
  evaluation: {
    metric: 'critical_visible_recall',
    value: 0.96,
    datasetReleaseId: 'sealed-event-v1',
    reportSha256: 'b'.repeat(64),
    reportPath: 'EVALUATION.json',
  },
  licenseNoticePath: 'NOTICE.txt',
  ...overrides,
});

describe('device model policy', () => {
  it('keeps small and unknown devices on deterministic behavior', () => {
    expect(recommendExecutionTier(device(2, 8))).toBe('deterministic');
    expect(
      recommendExecutionTier({ ...device(8, 20), totalMemoryBytes: null }),
    ).toBe('deterministic');
  });

  it('only nominates heavier tiers when RAM and free storage both allow it', () => {
    expect(recommendExecutionTier(device(4, 2))).toBe('compact-vision-candidate');
    expect(recommendExecutionTier(device(8, 8))).toBe('language-candidate');
  });

  it('rejects unreleased or unevaluated model packs', () => {
    expect(assessModelCompatibility(manifest({ status: 'unreleased', released: false }), device(8, 8))).toEqual({
      compatible: false,
      reasons: ['model_not_released'],
    });
    expect(assessModelCompatibility(manifest({ evaluation: undefined }), device(8, 8)).reasons)
      .toContain('evaluation_missing');
  });

  it('rejects placeholder resource budgets even if marked released', () => {
    const result = assessModelCompatibility(
      manifest({ minimumMemoryBytes: 0, estimatedPeakMemoryBytes: 0 }),
      device(8, 8),
    );
    expect(result.reasons).toContain('invalid_resource_budget');
  });

  it('respects the app memory ceiling and rejects unsafe package paths', () => {
    const constrained = assessModelCompatibility(
      manifest({
        estimatedPeakMemoryBytes: 400 * 1024 ** 2,
        licenseNoticePath: '../NOTICE.txt',
      }),
      device(8, 8),
    );
    expect(constrained.reasons).toContain('insufficient_app_memory_headroom');
    expect(constrained.reasons).toContain('license_notice_missing');
  });

  it('rejects malformed runtime JSON instead of throwing', () => {
    const malformed = {
      ...manifest(),
      id: 42,
      evaluation: 'not-an-object',
      supportedCpuArchitectures: [42],
    } as unknown as ModelPackManifest;
    const result = assessModelCompatibility(malformed, device(8, 8));
    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain('invalid_model_identity');
    expect(result.reasons).toContain('invalid_evaluation_evidence');
    expect(result.reasons).toContain('invalid_cpu_architectures');
  });

  it('chooses the lowest-memory package that meets the named quality floor', () => {
    const heavier = manifest({ id: 'heavy', estimatedPeakMemoryBytes: 500 * 1024 ** 2 });
    const efficient = manifest({ id: 'efficient', estimatedPeakMemoryBytes: 250 * 1024 ** 2 });
    const weak = manifest({
      id: 'weak',
      estimatedPeakMemoryBytes: 120 * 1024 ** 2,
      evaluation: { ...manifest().evaluation!, value: 0.8 },
    });

    expect(
      selectEfficientModel(
        [heavier, weak, efficient],
        device(8, 8),
        'visible-condition-segmentation',
        { metric: 'critical_visible_recall', minimumValue: 0.95 },
      )?.id,
    ).toBe('efficient');
  });
});
