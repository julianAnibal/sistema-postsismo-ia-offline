import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { CaptureQualityProxyResult } from './CaptureQualityProxy.types';

declare class CaptureQualityProxyNativeModule extends NativeModule {
  generateProxyAsync(uri: string): Promise<CaptureQualityProxyResult>;
}

export default requireOptionalNativeModule<CaptureQualityProxyNativeModule>('CaptureQualityProxy');
