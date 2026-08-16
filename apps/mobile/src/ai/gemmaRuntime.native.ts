import { File } from 'expo-file-system';

import GemmaLiteRtLm from '../../modules/gemma-litert-lm';
import { AssistantRequest } from './contracts';
import {
  buildGemmaPrompt,
  GEMMA_ANDROID_E2B_MODEL,
  GEMMA_SYSTEM_PROMPT,
} from './gemmaModel';
import {
  GemmaAvailability,
  GemmaGenerationResult,
  GemmaProgressListener,
  GemmaTokenListener,
} from './gemmaRuntime.types';

let generationSequence = 0;

const missingModule =
  'Este APK no incluye el módulo Android LiteRT-LM. Instale una compilación ARM64 actualizada.';

const requireModule = () => {
  if (!GemmaLiteRtLm) throw new Error(missingModule);
  return GemmaLiteRtLm;
};

const assertPinnedModel = (status: {
  modelId: string;
  revision: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  runtime: string;
}) => {
  if (
    status.modelId !== GEMMA_ANDROID_E2B_MODEL.id ||
    status.revision !== GEMMA_ANDROID_E2B_MODEL.revision ||
    status.fileName !== GEMMA_ANDROID_E2B_MODEL.fileName ||
    status.sizeBytes !== GEMMA_ANDROID_E2B_MODEL.sizeBytes ||
    status.sha256 !== GEMMA_ANDROID_E2B_MODEL.sha256 ||
    status.runtime !== GEMMA_ANDROID_E2B_MODEL.runtime
  ) {
    throw new Error('La identidad del modelo Android no coincide entre JavaScript y el módulo nativo.');
  }
};

const toAvailability = async (): Promise<GemmaAvailability> => {
  if (!GemmaLiteRtLm) {
    return { supported: false, installed: false, persistent: null, reason: missingModule };
  }
  const status = await GemmaLiteRtLm.inspectAsync();
  assertPinnedModel(status);
  return {
    supported: true,
    installed: status.installed,
    persistent: true,
    availableBytes: status.availableBytes,
    backend: status.backend,
    runtime: status.runtime,
  };
};

const withInstallProgress = async (
  onProgress: GemmaProgressListener,
  install: () => Promise<unknown>,
) => {
  const module = requireModule();
  const subscription = module.addListener('onGemmaInstallProgress', (event) => {
    onProgress({
      phase: event.phase,
      completedBytes: event.completedBytes,
      totalBytes: event.totalBytes,
    });
  });
  try {
    await install();
    return toAvailability();
  } finally {
    subscription.remove();
  }
};

export const inspectGemma = toAvailability;

export const installGemmaFromNetwork = async (
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability> =>
  withInstallProgress(onProgress, () => requireModule().installFromNetworkAsync());

export const installGemmaFromPicker = async (
  onProgress: GemmaProgressListener,
): Promise<GemmaAvailability> => {
  const current = await toAvailability();
  if (current.installed) return current;
  const picked = await File.pickFileAsync({
    mimeTypes: ['application/octet-stream', 'application/zip', '*/*'],
  });
  if (picked.canceled || !picked.result) return current;
  return withInstallProgress(onProgress, () =>
    requireModule().installFromUriAsync(picked.result.uri),
  );
};

export const loadGemma = async () => {
  const status = await requireModule().initializeAsync();
  assertPinnedModel(status);
};

export const generateWithGemma = async (
  request: AssistantRequest,
  onToken: GemmaTokenListener,
): Promise<GemmaGenerationResult> => {
  const module = requireModule();
  await loadGemma();
  const generationId = `gemma-${Date.now()}-${++generationSequence}`;
  const subscription = module.addListener('onGemmaGenerationChunk', (event) => {
    if (event.generationId !== generationId) return;
    onToken(event.text, event.chunk);
  });
  try {
    const result = await module.generateAsync(
      generationId,
      GEMMA_SYSTEM_PROMPT,
      buildGemmaPrompt(request),
    );
    return {
      text: result.text,
      elapsedMilliseconds: result.elapsedMilliseconds,
      modelId: GEMMA_ANDROID_E2B_MODEL.id,
      modelSha256: GEMMA_ANDROID_E2B_MODEL.sha256,
      backend: result.backend,
    };
  } finally {
    subscription.remove();
  }
};

export const cancelGemma = () => {
  GemmaLiteRtLm?.cancelGeneration();
};

export const unloadGemma = async () => {
  await GemmaLiteRtLm?.unloadAsync();
};
