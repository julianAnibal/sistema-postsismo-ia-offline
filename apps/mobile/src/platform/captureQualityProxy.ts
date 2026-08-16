import { File } from 'expo-file-system';
import { decode } from 'jpeg-js';
import { Platform } from 'react-native';

import CaptureQualityProxyModule from '../../modules/capture-quality-proxy';
import { measurePixelProxy } from '../domain/captureQuality';
import type { CaptureQualityMeasurement } from '../domain/types';

const PROXY_LONG_EDGE = 96;

const nativeFailureReason = (error: unknown) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  if (code === 'ERR_CAPTURE_PROXY_OUT_OF_MEMORY') return 'out_of_memory' as const;
  if (
    code.includes('UNSUPPORTED') ||
    code.includes('INVALID') ||
    code.includes('INPUT_NOT_FOUND') ||
    code.includes('INPUT_TOO_LARGE') ||
    code.includes('ANIMATED')
  ) {
    return 'input_rejected' as const;
  }
  return 'proxy_failed' as const;
};

const baseMeasurement = (checkedAt: string) => ({
  schemaVersion: 1 as const,
  checkedAt,
  modelUsed: false as const,
  networkRequired: false as const,
  releaseStatus: 'shadow' as const,
  scope: 'extreme-pixel-proxy-v1' as const,
});

export const analyzeCaptureQualityProxy = async (
  uri: string,
  width: number,
  height: number,
): Promise<CaptureQualityMeasurement> => {
  const checkedAt = new Date().toISOString();
  if (Platform.OS !== 'android' || !CaptureQualityProxyModule) {
    return {
      ...baseMeasurement(checkedAt),
      status: 'unsupported',
      reason: Platform.OS === 'web' ? 'web_memory_guard' : 'native_proxy_unavailable',
    };
  }

  let proxyFile: File | null = null;
  const started = Date.now();
  try {
    const proxy = await CaptureQualityProxyModule.generateProxyAsync(uri);
    proxyFile = new File(proxy.uri);
    const encoded = await proxyFile.bytes();
    if (
      proxy.width <= 0 ||
      proxy.height <= 0 ||
      Math.max(proxy.width, proxy.height) > PROXY_LONG_EDGE ||
      proxy.encodedBytes !== encoded.byteLength
    ) {
      throw new Error('native proxy contract mismatch');
    }
    const decoded = decode(encoded, {
      formatAsRGBA: true,
      maxMemoryUsageInMB: 4,
      maxResolutionInMP: 1,
      tolerantDecoding: false,
      useTArray: true,
    });
    if (decoded.width !== proxy.width || decoded.height !== proxy.height) {
      throw new Error('decoded proxy dimensions do not match native contract');
    }
    const { metrics, signalIds } = measurePixelProxy(decoded.data, decoded.width, decoded.height);
    return {
      ...baseMeasurement(checkedAt),
      status: 'measured',
      proxy: {
        width: decoded.width,
        height: decoded.height,
        encodedBytes: encoded.byteLength,
        decodedBytes: decoded.data.byteLength,
        accountedBufferBytes:
          encoded.byteLength +
          decoded.data.byteLength +
          proxy.decodedWidth * proxy.decodedHeight * 4 +
          proxy.width * proxy.height * 4,
      },
      metrics,
      signalIds,
      processingMilliseconds: Math.max(Date.now() - started, proxy.processingMilliseconds),
    };
  } catch (error) {
    return {
      ...baseMeasurement(checkedAt),
      status: 'error',
      reason: nativeFailureReason(error),
    };
  } finally {
    if (proxyFile?.exists) {
      try {
        proxyFile.delete();
      } catch {
        // The analysis result remains valid if the cache was already reclaimed.
      }
    }
  }
};
