import { AssistantRequest } from './contracts';
import {
  GemmaAvailability,
  GemmaGenerationResult,
  GemmaProgressListener,
  GemmaTokenListener,
} from './gemmaRuntime.types';

export function inspectGemma(): Promise<GemmaAvailability>;
export function installGemmaFromNetwork(
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability>;
export function installGemmaFromPicker(
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability>;
export function loadGemma(): Promise<void>;
export function generateWithGemma(
  request: AssistantRequest,
  onToken: GemmaTokenListener,
): Promise<GemmaGenerationResult>;
export function cancelGemma(): void;
export function unloadGemma(): Promise<void>;
