import { CapturePreflight } from './types';

const MIN_SHORT_EDGE = 720;
const MIN_PIXEL_COUNT = 1_000_000;
const MAX_ASPECT_RATIO = 4;
const MIN_FILE_BYTES = 50 * 1024;

export const capturePreflightLabels: Record<CapturePreflight['issueIds'][number], string> = {
  dimensions_unknown: 'el dispositivo no informó dimensiones',
  resolution_low: 'la resolución es inferior al mínimo de referencia',
  aspect_extreme: 'la proporción es demasiado extrema para una vista de inspección',
  file_suspiciously_small: 'el archivo es inusualmente pequeño',
};

export const assessCapturePreflight = (
  width: number,
  height: number,
  sizeBytes: number,
  checkedAt = new Date().toISOString(),
): CapturePreflight => {
  const issueIds: CapturePreflight['issueIds'] = [];
  if (width <= 0 || height <= 0) {
    issueIds.push('dimensions_unknown');
  } else {
    if (Math.min(width, height) < MIN_SHORT_EDGE || width * height < MIN_PIXEL_COUNT) {
      issueIds.push('resolution_low');
    }
    const aspect = Math.max(width, height) / Math.min(width, height);
    if (aspect > MAX_ASPECT_RATIO) issueIds.push('aspect_extreme');
  }
  if (sizeBytes < MIN_FILE_BYTES) issueIds.push('file_suspiciously_small');
  return {
    status: issueIds.length ? 'review' : 'pass',
    checkedAt,
    scope: 'metadata-only',
    issueIds,
  };
};
