import { describe, expect, it } from 'vitest';

import { createSeedState } from '../data/seed';
import { buildRestrictedReducedExport } from './exportManifest';

describe('restricted reduced export manifest', () => {
  it('omits free text, coordinates, sensor values, EXIF, device fingerprints, and local URIs', () => {
    const state = createSeedState();
    state.inspections[0].notes = 'PERSONA-SECRETA';
    state.media = [{
      id: 'media-private',
      inspectionId: state.inspections[0].id,
      uri: 'file:///private/evidence.jpg',
      sha256: 'a'.repeat(64),
      sizeBytes: 123,
      storage: 'app-file',
      capturePreflight: {
        status: 'pass',
        checkedAt: '2038-01-19T10:00:00.000Z',
        scope: 'metadata-only',
        issueIds: [],
      },
      captureQuality: {
        schemaVersion: 1,
        checkedAt: '2038-01-19T10:00:00.000Z',
        modelUsed: false,
        networkRequired: false,
        releaseStatus: 'shadow',
        scope: 'extreme-pixel-proxy-v1',
        status: 'unsupported',
        reason: 'legacy_not_measured',
      },
      mimeType: 'image/jpeg',
      width: 100,
      height: 100,
      capturedAt: '2038-01-19T10:00:00.000Z',
      provenance: 'camera',
      sensorMetadata: {
        recordedAt: '2038-01-19T10:00:00.000Z',
        location: {
          status: 'captured',
          latitude: 4.123456,
          longitude: -74.123456,
          accuracyMeters: 3,
        },
        motion: {
          status: 'captured',
          rotation: { alpha: 1, beta: 2, gamma: 3, timestamp: 2_147_483_647_000 },
        },
        device: {
          manufacturer: 'PRIVATE-MAKER',
          modelName: 'PRIVATE-MODEL',
          osName: 'Android',
          osVersion: '16',
          isDevice: true,
          totalMemoryBytes: 4_000_000_000,
          supportedCpuArchitectures: ['arm64-v8a'],
        },
        exif: { OwnerName: 'PERSONA-SECRETA' },
      },
      integrity: {
        status: 'verified',
        checkedAt: '2038-01-19T10:00:00.000Z',
        actualSha256: 'a'.repeat(64),
      },
      immutable: true,
    }];

    const exported = buildRestrictedReducedExport(state, '2038-01-19T11:00:00.000Z');
    const encoded = JSON.stringify(exported);
    expect(encoded).not.toContain('PERSONA-SECRETA');
    expect(encoded).not.toContain('PRIVATE-MAKER');
    expect(encoded).not.toContain('PRIVATE-MODEL');
    expect(encoded).not.toContain('file:///private');
    expect(encoded).not.toContain('4.123456');
    expect(encoded).not.toContain('-74.123456');
    expect(exported.mediaManifest[0].sensorAvailability).toEqual({
      location: 'captured',
      motion: 'captured',
    });
    expect(exported.mediaManifest[0].binaryIncluded).toBe(false);
    expect(exported.sensitivity).toBe('restricted-personal-and-operational-data');
    expect(exported.retainedSensitiveFields).toContain('occupant_and_support_counts');
  });
});
