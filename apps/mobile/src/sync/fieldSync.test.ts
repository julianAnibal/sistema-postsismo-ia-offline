import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSeedState } from '../data/seed';
import type { AppState, MediaEvidence } from '../domain/types';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value);
  });
  clear = () => this.values.clear();
}

const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
vi.stubGlobal('sessionStorage', sessionStorage);
vi.stubGlobal('localStorage', localStorage);

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-community/netinfo', () => ({
  default: { fetch: vi.fn(() => Promise.resolve({ isConnected: true })) },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));
vi.mock('expo-file-system', () => ({
  File: class {
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'installation-test-id',
  digestStringAsync: vi.fn(() => Promise.resolve('a'.repeat(64))),
  digest: vi.fn(() => Promise.resolve(new Uint8Array(32).fill(0xbb).buffer)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
vi.mock('../storage/evidenceFiles', () => ({
  verifyEvidenceFiles: vi.fn((items: MediaEvidence[]) => Promise.resolve(items)),
}));

const makeMedia = (): MediaEvidence => ({
  id: 'media-1',
  inspectionId: 'inspection-01',
  uri: 'data:image/jpeg;base64,AQID',
  sha256: 'bb'.repeat(32),
  sizeBytes: 3,
  storage: 'inline-web',
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
  width: 640,
  height: 480,
  capturedAt: '2038-01-19T10:00:00.000Z',
  provenance: 'library',
  sensorMetadata: {
    recordedAt: '2038-01-19T10:00:00.000Z',
    location: { status: 'unavailable' },
    motion: { status: 'unavailable' },
    device: {
      manufacturer: 'Test',
      modelName: 'Browser',
      osName: 'Web',
      osVersion: '1',
      isDevice: false,
      totalMemoryBytes: 123,
      supportedCpuArchitectures: ['test'],
    },
    exif: null,
  },
  integrity: {
    status: 'verified',
    checkedAt: '2038-01-19T10:00:00.000Z',
    actualSha256: 'bb'.repeat(32),
  },
  immutable: true,
});

const makePendingState = (): AppState => {
  const seed = createSeedState();
  const media = makeMedia();
  const inspection = {
    ...seed.inspections[0],
    mediaIds: [media.id],
    updatedAt: '2038-01-19T10:00:01.000Z',
  };
  const annotation = {
    id: 'annotation-1',
    mediaId: media.id,
    source: 'manual' as const,
    element: 'wall' as const,
    condition: 'crack' as const,
    observability: 'good' as const,
    viewType: 'detail' as const,
    createdAt: '2038-01-19T10:00:02.000Z',
  };
  return {
    ...seed,
    inspections: [inspection, ...seed.inspections.slice(1)],
    media: [media],
    annotations: [annotation],
    outbox: [
      {
        id: `outbox-inspection-${inspection.id}`,
        entityType: 'inspection',
        entityId: inspection.id,
        operation: 'upsert',
        createdAt: '2038-01-19T10:00:01.000Z',
        status: 'pending',
      },
      {
        id: `outbox-media-${media.id}`,
        entityType: 'media',
        entityId: media.id,
        operation: 'upsert',
        createdAt: '2038-01-19T10:00:02.000Z',
        status: 'pending',
      },
      {
        id: `outbox-annotation-${annotation.id}`,
        entityType: 'annotation',
        entityId: annotation.id,
        operation: 'upsert',
        createdAt: '2038-01-19T10:00:03.000Z',
        status: 'pending',
      },
    ],
  };
};

describe('field synchronization', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    delete process.env.EXPO_PUBLIC_FIELD_API_URL;
    const { saveSyncSettings } = await import('./fieldSync');
    await saveSyncSettings('https://api.example.test/', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('sessionStorage', sessionStorage);
    vi.stubGlobal('localStorage', localStorage);
  });

  it('keeps batch IDs and creation time stable across outbox array order', async () => {
    const state = makePendingState();
    const reversed = { ...state, outbox: [...state.outbox].reverse() };
    const Crypto = await import('expo-crypto');
    const digest = vi.mocked(Crypto.digestStringAsync);
    digest.mockClear();
    const { buildBatchCreatedAt, buildBatchId } = await import('./fieldSync');

    expect(await buildBatchId(state, 'device-hash')).toBe(await buildBatchId(reversed, 'device-hash'));
    expect(digest.mock.calls[0]?.[1]).toBe(digest.mock.calls[1]?.[1]);
    expect(buildBatchCreatedAt(reversed)).toBe('2038-01-19T10:00:01.000Z');
  });

  it('maps only backend-compatible media metadata', async () => {
    const { mapMediaForFieldSync } = await import('./fieldSync');
    const mapped = mapMediaForFieldSync(makeMedia());

    expect(mapped).not.toHaveProperty('uri');
    expect(mapped).not.toHaveProperty('storage');
    expect(mapped).not.toHaveProperty('integrity');
    expect(mapped).not.toHaveProperty('captureQuality');
    expect(mapped).not.toHaveProperty('capturePreflight');
    expect(mapped.sensorMetadata.device).not.toHaveProperty('totalMemoryBytes');
    expect(mapped.sensorMetadata.device).not.toHaveProperty('supportedCpuArchitectures');
  });

  it('posts the batch before uploading the exact verified bytes', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.startsWith('data:')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/jpeg' },
        });
      }
      return new Response(JSON.stringify({ data: { status: 'stored' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { synchronizeFieldState } = await import('./fieldSync');

    const result = await synchronizeFieldState(makePendingState());
    const batchIndex = requests.findIndex((item) => item.url.endsWith('/field-sync'));
    const mediaIndex = requests.findIndex((item) => item.url.endsWith('/field-media'));
    expect(batchIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(batchIndex);

    const batch = JSON.parse(String(requests[batchIndex]?.init?.body));
    expect(batch.schemaVersion).toBe(1);
    expect(batch.media).toHaveLength(1);
    expect(batch.media[0]).not.toHaveProperty('uri');
    expect(batch.media[0].sha256).toBe('bb'.repeat(32));
    expect(result.acknowledgedOutboxItems).toHaveLength(3);

    const uploaded = requests[mediaIndex]?.init?.body as Blob;
    expect([...new Uint8Array(await uploaded.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(requests[mediaIndex]?.init?.headers).toMatchObject({
      'x-content-sha256': 'bb'.repeat(32),
      'content-type': 'image/jpeg',
    });
  });

  it('fails closed before any network request when re-verification finds tampering', async () => {
    const { verifyEvidenceFiles } = await import('../storage/evidenceFiles');
    vi.mocked(verifyEvidenceFiles).mockImplementationOnce(async (items) => items.map((item) => ({
      ...item,
      integrity: {
        status: 'tampered',
        checkedAt: '2038-01-19T10:00:04.000Z',
        reason: 'sha256_mismatch',
      },
    })));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { synchronizeFieldState } = await import('./fieldSync');

    await expect(synchronizeFieldState(makePendingState())).rejects.toThrow('Sincronización bloqueada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails clearly before the batch when the backend does not accept the image MIME type', async () => {
    const state = makePendingState();
    state.media[0] = { ...state.media[0], mimeType: 'image/heic' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { synchronizeFieldState } = await import('./fieldSync');

    await expect(synchronizeFieldState(state)).rejects.toThrow('un formato que este servidor todavía no admite');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
