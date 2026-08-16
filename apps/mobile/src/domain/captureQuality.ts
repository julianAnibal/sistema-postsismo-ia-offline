import type {
  CaptureQualityMetrics,
  CaptureQualitySignal,
} from './types';

const DARK_CLIP_MAX = 5;
const BRIGHT_CLIP_MIN = 250;

export const captureQualitySignalLabels: Record<CaptureQualitySignal, string> = {
  nearly_all_dark: 'el proxy está casi completamente oscuro',
  nearly_all_bright: 'el proxy está casi completamente claro',
  nearly_uniform: 'el proxy conserva muy poca variación tonal',
};

const percentile = (histogram: Uint32Array, total: number, fraction: number) => {
  const target = Math.ceil(total * fraction);
  let cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= target) return value;
  }
  return 255;
};

export const measurePixelProxy = (
  rgba: Uint8Array,
  width: number,
  height: number,
): { metrics: CaptureQualityMetrics; signalIds: CaptureQualitySignal[] } => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
    throw new Error('pixel proxy dimensions must be integers of at least 3x3');
  }
  const pixelCount = width * height;
  if (rgba.length !== pixelCount * 4) throw new Error('pixel proxy must contain exact RGBA bytes');

  const luminance = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);
  let sum = 0;
  let sumSquares = 0;
  let darkClipped = 0;
  let brightClipped = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const value = 0.2126 * rgba[offset] + 0.7152 * rgba[offset + 1] + 0.0722 * rgba[offset + 2];
    luminance[pixel] = value;
    sum += value;
    sumSquares += value * value;
    const bucket = Math.max(0, Math.min(255, Math.round(value)));
    histogram[bucket] += 1;
    if (value <= DARK_CLIP_MAX) darkClipped += 1;
    if (value >= BRIGHT_CLIP_MIN) brightClipped += 1;
  }
  const mean = sum / pixelCount;
  const standardDeviation = Math.sqrt(Math.max(0, sumSquares / pixelCount - mean * mean));
  let entropyBits = 0;
  for (const count of histogram) {
    if (!count) continue;
    const probability = count / pixelCount;
    entropyBits -= probability * Math.log2(probability);
  }

  let laplacianSum = 0;
  let laplacianSquares = 0;
  let interiorCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const value =
        luminance[index - width] +
        luminance[index + width] +
        luminance[index - 1] +
        luminance[index + 1] -
        4 * luminance[index];
      laplacianSum += value;
      laplacianSquares += value * value;
      interiorCount += 1;
    }
  }
  const laplacianMean = laplacianSum / interiorCount;
  const laplacianVariance = Math.max(
    0,
    laplacianSquares / interiorCount - laplacianMean * laplacianMean,
  );
  const lowClipFraction = darkClipped / pixelCount;
  const highClipFraction = brightClipped / pixelCount;
  const metrics: CaptureQualityMetrics = {
    meanLuminance: mean,
    luminanceStandardDeviation: standardDeviation,
    lowClipFraction,
    highClipFraction,
    p01Luminance: percentile(histogram, pixelCount, 0.01),
    p99Luminance: percentile(histogram, pixelCount, 0.99),
    entropyBits,
    laplacianVariance,
  };
  const signalIds: CaptureQualitySignal[] = [];
  if (mean <= 8 || lowClipFraction >= 0.85) signalIds.push('nearly_all_dark');
  if (mean >= 247 || highClipFraction >= 0.85) signalIds.push('nearly_all_bright');
  if (standardDeviation < 4 && laplacianVariance < 20) signalIds.push('nearly_uniform');
  return { metrics, signalIds };
};
