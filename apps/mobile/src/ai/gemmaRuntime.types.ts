import { AssistantRequest } from './contracts';

export type GemmaInstallPhase = 'downloading' | 'importing' | 'verifying';

export interface GemmaInstallProgress {
  phase: GemmaInstallPhase;
  completedBytes: number;
  totalBytes: number;
}

export interface GemmaAvailability {
  supported: boolean;
  installed: boolean;
  persistent: boolean | null;
  reason?: string;
  quotaBytes?: number;
  usageBytes?: number;
  availableBytes?: number;
  backend?: string;
  runtime?: string;
}

export interface GemmaGenerationResult {
  text: string;
  elapsedMilliseconds: number;
  modelId: string;
  modelSha256: string;
  backend?: string;
}

export type GemmaProgressListener = (progress: GemmaInstallProgress) => void;
export type GemmaTokenListener = (fullText: string, tokenText: string) => void;

export interface GemmaRuntimeApi {
  inspectGemma(): Promise<GemmaAvailability>;
  installGemmaFromNetwork(onProgress: GemmaProgressListener): Promise<GemmaAvailability>;
  installGemmaFromPicker(onProgress: GemmaProgressListener): Promise<GemmaAvailability>;
  loadGemma(): Promise<void>;
  generateWithGemma(
    request: AssistantRequest,
    onToken: GemmaTokenListener,
  ): Promise<GemmaGenerationResult>;
  cancelGemma(): void;
  unloadGemma(): Promise<void>;
}
