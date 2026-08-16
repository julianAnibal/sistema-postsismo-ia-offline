import { describe, expect, it } from 'vitest';

import { createSeedState } from '../data/seed';
import { computeGridMetrics } from './analytics';

describe('computeGridMetrics', () => {
  it('keeps coverage and reviewed damage as separate denominators', () => {
    const state = createSeedState();
    const coverageA1 = computeGridMetrics(state, 'coverage').find((item) => item.cellId === 'A1');
    const damageA2 = computeGridMetrics(state, 'reviewed_damage').find(
      (item) => item.cellId === 'A2',
    );

    expect(coverageA1).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
    expect(damageA2).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it('reports no data instead of zero damage when a cell has no review', () => {
    const state = createSeedState();
    const metric = computeGridMetrics(state, 'reviewed_damage').find(
      (item) => item.cellId === 'B2',
    );

    expect(metric).toMatchObject({ numerator: 0, denominator: 0, value: null });
  });

  it('does not count a manual annotation as a completed AI analysis', () => {
    const state = createSeedState();
    state.media.push({
      id: 'media-test',
      inspectionId: 'inspection-01',
      uri: 'data:image/jpeg;base64,c3ludGhldGlj',
      sha256: 'synthetic-hash',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
      capturedAt: '2038-01-19T10:00:00.000Z',
      provenance: 'library',
      sensorMetadata: {
        recordedAt: '2038-01-19T10:00:00.000Z',
        location: { status: 'unavailable' },
        motion: { status: 'unavailable' },
        device: {
          manufacturer: null,
          modelName: null,
          osName: null,
          osVersion: null,
          isDevice: false,
        },
        exif: null,
      },
      immutable: true,
    });
    state.annotations.push({
      id: 'annotation-test',
      mediaId: 'media-test',
      source: 'manual',
      element: 'wall',
      condition: 'crack',
      observability: 'good',
      viewType: 'detail',
      createdAt: '2038-01-19T10:00:00.000Z',
    });

    const metric = computeGridMetrics(state, 'pending_ai').find((item) => item.cellId === 'A1');
    expect(metric).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });
});
