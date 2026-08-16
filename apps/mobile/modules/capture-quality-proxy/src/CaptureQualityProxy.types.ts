export type CaptureQualityProxyDecoder = 'image-decoder' | 'bitmap-factory';

export interface CaptureQualityProxyResult {
  uri: string;
  width: number;
  height: number;
  encodedWidth: number;
  encodedHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  decodedWidth: number;
  decodedHeight: number;
  inputBytes: number;
  encodedBytes: number;
  decoder: CaptureQualityProxyDecoder;
  requestedSampleSize: number | null;
  exifOrientation: number;
  orientationApplied: boolean;
  processingMilliseconds: number;
}
