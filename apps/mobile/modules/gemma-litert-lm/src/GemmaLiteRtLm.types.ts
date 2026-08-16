import { NativeModule } from 'expo-modules-core';

export type NativeInstallPhase = 'downloading' | 'importing' | 'verifying';

export type NativeGemmaStatus = {
  installed: boolean;
  availableBytes: number;
  modelId: string;
  revision: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  runtime: string;
  backend?: string;
};

export type NativeGenerationResult = {
  text: string;
  elapsedMilliseconds: number;
  backend: string;
};

type GemmaEvents = {
  onGemmaInstallProgress: (event: {
    phase: NativeInstallPhase;
    completedBytes: number;
    totalBytes: number;
  }) => void;
  onGemmaGenerationChunk: (event: {
    generationId: string;
    text: string;
    chunk: string;
  }) => void;
};

export declare class GemmaLiteRtLmNativeModule extends NativeModule<GemmaEvents> {
  inspectAsync(): Promise<NativeGemmaStatus>;
  installFromNetworkAsync(): Promise<NativeGemmaStatus>;
  installFromUriAsync(uri: string): Promise<NativeGemmaStatus>;
  initializeAsync(): Promise<NativeGemmaStatus>;
  generateAsync(
    generationId: string,
    systemPrompt: string,
    prompt: string,
  ): Promise<NativeGenerationResult>;
  cancelGeneration(): void;
  unloadAsync(): Promise<void>;
}
