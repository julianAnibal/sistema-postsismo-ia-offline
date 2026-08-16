import { requireOptionalNativeModule } from 'expo-modules-core';

import { GemmaLiteRtLmNativeModule } from './GemmaLiteRtLm.types';

export default requireOptionalNativeModule<GemmaLiteRtLmNativeModule>('GemmaLiteRtLm');
