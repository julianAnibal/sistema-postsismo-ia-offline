import { describe, expect, it } from 'vitest';

import {
  contentAddressedImageName,
  digestToHex,
  estimateBase64Bytes,
  isSha256Hex,
  legacyInlineSize,
  parseInlineImageDataUri,
  safeEvidenceStem,
  safeImageExtension,
} from './evidenceFilePolicy';

describe('evidence file policy', () => {
  it('calculates decoded Base64 bytes without charging padding', () => {
    expect(estimateBase64Bytes('YQ==')).toBe(1);
    expect(estimateBase64Bytes('YWI=')).toBe(2);
    expect(estimateBase64Bytes('YWJj')).toBe(3);
  });

  it('uses only known image extensions', () => {
    expect(safeImageExtension('capture.JPEG', 'image/jpeg')).toBe('.jpg');
    expect(safeImageExtension('../../evidence.exe', 'image/png')).toBe('.png');
  });

  it('renders full SHA bytes as lowercase hexadecimal', () => {
    expect(digestToHex(new Uint8Array([0, 15, 16, 255]).buffer)).toBe('000f10ff');
  });

  it('requires strict lowercase SHA-256 and builds content-addressed names', () => {
    const sha256 = 'a'.repeat(64);
    expect(isSha256Hex(sha256)).toBe(true);
    expect(isSha256Hex('A'.repeat(64))).toBe(false);
    expect(isSha256Hex('a'.repeat(63))).toBe(false);
    expect(contentAddressedImageName(sha256, 'image/jpeg')).toBe(`${sha256}.jpg`);
  });

  it('rejects traversal and malformed inline image data', () => {
    expect(() => safeEvidenceStem('../../outside')).toThrow('unsafe evidence file stem');
    expect(safeEvidenceStem('media-safe_01')).toBe('media-safe_01');
    expect(parseInlineImageDataUri('data:image/jpeg;base64,YWJj')).toEqual({
      mimeType: 'image/jpeg',
      base64: 'YWJj',
      sizeBytes: 3,
    });
    expect(parseInlineImageDataUri('data:text/plain;base64,YWJj')).toBeNull();
    expect(parseInlineImageDataUri('data:image/jpeg;base64,%%%')).toBeNull();
  });

  it('estimates legacy inline media size during migration', () => {
    expect(legacyInlineSize('data:image/jpeg;base64,YWJj')).toBe(3);
    expect(legacyInlineSize('file:///evidence.jpg')).toBe(0);
  });
});
