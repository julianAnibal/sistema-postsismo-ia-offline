import { describe, expect, it } from 'vitest';

import { createSeedState } from '../data/seed';
import { migrateFieldState } from './migrations';

describe('field state migrations', () => {
  it('moves schema v1 inline evidence to the v2 manifest shape', () => {
    const seed = createSeedState();
    const legacy = {
      ...seed,
      schemaVersion: 1,
      media: [
        {
          id: 'legacy-media',
          inspectionId: 'inspection-01',
          uri: 'data:image/jpeg;base64,YWJj',
          sha256: 'legacy-hash',
          mimeType: 'image/jpeg',
          width: 10,
          height: 10,
          capturedAt: '2038-01-19T10:00:00.000Z',
          provenance: 'library',
          capturePreflight: {
            status: 'pass',
            checkedAt: '2038-01-19T10:00:00.000Z',
            scope: 'metadata-only',
            issueIds: [],
          },
          sensorMetadata: { location: 'corrupt', device: { totalMemoryBytes: 'unknown' } },
          immutable: true,
        },
      ],
    };

    const migrated = migrateFieldState(legacy);
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.media[0]).toMatchObject({
      sha256: '0'.repeat(64),
      sizeBytes: 3,
      storage: 'inline-web',
      integrity: { status: 'unverified', reason: 'not_checked' },
      sensorMetadata: {
        location: { status: 'unavailable' },
        device: { totalMemoryBytes: null, supportedCpuArchitectures: [] },
      },
      capturePreflight: { status: 'review' },
      captureQuality: { status: 'unsupported', reason: 'legacy_not_measured' },
    });
  });

  it('rejects corrupt state instead of partially trusting it', () => {
    expect(migrateFieldState({ schemaVersion: 2, media: 'not-an-array' })).toBeNull();
  });

  it('does not trust impossible persisted pixel-proxy measurements', () => {
    const seed = createSeedState();
    const capturedAt = '2038-01-19T10:00:00.000Z';
    const state = {
      ...seed,
      media: [{
        id: 'tampered-media',
        inspectionId: 'inspection-01',
        uri: 'file:///evidence/tampered.jpg',
        sha256: 'a'.repeat(64),
        sizeBytes: 512,
        storage: 'app-file',
        mimeType: 'image/jpeg',
        width: 96,
        height: 96,
        capturedAt,
        provenance: 'camera',
        sensorMetadata: {
          recordedAt: capturedAt,
          location: { status: 'unavailable' },
          motion: { status: 'unavailable' },
          device: {
            manufacturer: null,
            modelName: null,
            osName: 'Android',
            osVersion: '15',
            isDevice: true,
            totalMemoryBytes: 4_000_000_000,
            supportedCpuArchitectures: ['arm64-v8a'],
          },
          exif: null,
        },
        captureQuality: {
          schemaVersion: 1,
          checkedAt: capturedAt,
          modelUsed: false,
          networkRequired: false,
          releaseStatus: 'shadow',
          scope: 'extreme-pixel-proxy-v1',
          status: 'measured',
          proxy: {
            width: 96,
            height: 96,
            encodedBytes: 128,
            decodedBytes: 1,
            accountedBufferBytes: 129,
          },
          metrics: {
            meanLuminance: 128,
            luminanceStandardDeviation: 20,
            lowClipFraction: 0,
            highClipFraction: 0,
            p01Luminance: 20,
            p99Luminance: 220,
            entropyBits: 5,
            laplacianVariance: 100,
          },
          signalIds: [],
          processingMilliseconds: 4,
        },
        immutable: true,
      }],
    };

    expect(migrateFieldState(state)?.media[0].captureQuality).toMatchObject({
      status: 'unsupported',
      reason: 'legacy_not_measured',
    });

    state.media[0].captureQuality.proxy.decodedBytes = 96 * 96 * 4;
    state.media[0].captureQuality.proxy.accountedBufferBytes =
      state.media[0].captureQuality.proxy.encodedBytes +
      state.media[0].captureQuality.proxy.decodedBytes * 3;
    expect(migrateFieldState(state)?.media[0].captureQuality).toMatchObject({
      status: 'measured',
      proxy: { width: 96, height: 96 },
    });
  });

  it('rejects a v2 fingerprint that is not strict lowercase SHA-256 hex', () => {
    const seed = createSeedState();
    const capturedAt = '2038-01-19T10:00:00.000Z';
    const legacyLikeMedia = {
      id: 'media-invalid-sha',
      inspectionId: 'inspection-01',
      uri: 'file:///evidence.jpg',
      sha256: 'NOT-A-SHA',
      sizeBytes: 3,
      storage: 'app-file',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
      capturedAt,
      provenance: 'library',
      sensorMetadata: {
        recordedAt: capturedAt,
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
      },
      immutable: true,
    };

    expect(migrateFieldState({ ...seed, media: [legacyLikeMedia] })).toBeNull();
  });
});
