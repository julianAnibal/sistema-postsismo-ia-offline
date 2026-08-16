import { describe, expect, it } from 'vitest';

import { measurePixelProxy } from './captureQuality';

const solid = (value: number, width = 8, height = 8) => {
  const bytes = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes[offset] = value;
    bytes[offset + 1] = value;
    bytes[offset + 2] = value;
    bytes[offset + 3] = 255;
  }
  return bytes;
};

describe('capture quality pixel proxy', () => {
  it('identifies an almost black uniform proxy without a model', () => {
    const result = measurePixelProxy(solid(0), 8, 8);
    expect(result.signalIds).toEqual(['nearly_all_dark', 'nearly_uniform']);
    expect(result.metrics.lowClipFraction).toBe(1);
    expect(result.metrics.laplacianVariance).toBe(0);
  });

  it('identifies an almost white uniform proxy', () => {
    const result = measurePixelProxy(solid(255), 8, 8);
    expect(result.signalIds).toEqual(['nearly_all_bright', 'nearly_uniform']);
    expect(result.metrics.highClipFraction).toBe(1);
  });

  it('keeps textured midtones as measurements rather than calling them good', () => {
    const bytes = solid(0);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const value = (x + y) % 2 ? 48 : 208;
        const offset = (y * 8 + x) * 4;
        bytes[offset] = value;
        bytes[offset + 1] = value;
        bytes[offset + 2] = value;
      }
    }
    const result = measurePixelProxy(bytes, 8, 8);
    expect(result.signalIds).toEqual([]);
    expect(result.metrics.laplacianVariance).toBeGreaterThan(0);
    expect(result.metrics.meanLuminance).toBeCloseTo(128, 5);
  });

  it('rejects malformed buffers at the trust boundary', () => {
    expect(() => measurePixelProxy(new Uint8Array(8), 8, 8)).toThrow('exact RGBA bytes');
  });
});
