import {
  Backend,
  Engine as LiteRtEngine,
  loadLiteRtLm,
} from '@litert-lm/core';
import type {
  Conversation,
  Engine as LiteRtEngineInstance,
} from '@litert-lm/core';

import { AssistantRequest } from './contracts';
import {
  buildGemmaPrompt,
  GEMMA_E2B_MODEL,
  GEMMA_SYSTEM_PROMPT,
} from './gemmaModel';
import {
  getProvisionedGemmaFile,
  inspectGemma,
  installGemmaFromNetwork,
  installGemmaFromPicker,
} from './gemmaModelStore.web';
import {
  GemmaGenerationResult,
  GemmaTokenListener,
} from './gemmaRuntime.types';

const WASM_RUNTIME_PATH =
  '/litert-lm/wasm/litertlm_wasm_compat_asyncify_internal.js';

let engine: LiteRtEngineInstance | null = null;
let activeConversation: Conversation | null = null;
let loadPromise: Promise<void> | null = null;
let wasmLoaded = false;

export { inspectGemma, installGemmaFromNetwork, installGemmaFromPicker };

export const loadGemma = async () => {
  if (engine) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const availability = await inspectGemma();
    if (!availability.supported) throw new Error(availability.reason);
    if (!availability.installed) {
      throw new Error('Instale y verifique Gemma 4 E2B antes de cargarlo.');
    }

    const model = await getProvisionedGemmaFile();
    if (!wasmLoaded) {
      await loadLiteRtLm(WASM_RUNTIME_PATH);
      wasmLoaded = true;
    }
    engine = await LiteRtEngine.create({
      model,
      backend: Backend.GPU_ARTISAN,
      mainExecutorSettings: {
        maxNumTokens: 2_048,
      },
      benchmarkEnabled: true,
    });
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
};

const textFromChunk = (content: unknown) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (item): item is { type: 'text'; text: string } =>
        Boolean(item) &&
        typeof item === 'object' &&
        (item as { type?: unknown }).type === 'text' &&
        typeof (item as { text?: unknown }).text === 'string',
    )
    .map((item) => item.text)
    .join('');
};

export const generateWithGemma = async (
  request: AssistantRequest,
  onToken: GemmaTokenListener,
): Promise<GemmaGenerationResult> => {
  await loadGemma();
  if (!engine) throw new Error('LiteRT-LM no pudo inicializar Gemma.');
  if (activeConversation) throw new Error('Gemma ya está generando una respuesta.');

  const startedAt = performance.now();
  let text = '';
  const conversation = await engine.createConversation({
    preface: {
      messages: [{ role: 'system', content: GEMMA_SYSTEM_PROMPT }],
    },
    sessionConfig: {
      maxOutputTokens: 256,
      samplerParams: { temperature: 0.15, k: 16, p: 0.9, seed: 1_000 },
    },
    prefillPrefaceOnInit: true,
  });
  activeConversation = conversation;

  try {
    const stream = conversation.sendMessageStreaming(buildGemmaPrompt(request));
    for await (const chunk of stream) {
      const tokenText = textFromChunk(chunk.content);
      if (!tokenText) continue;
      text += tokenText;
      onToken(text, tokenText);
    }
    return {
      text: text.trim(),
      elapsedMilliseconds: Math.round(performance.now() - startedAt),
      modelId: GEMMA_E2B_MODEL.id,
      modelSha256: GEMMA_E2B_MODEL.sha256,
    };
  } finally {
    activeConversation = null;
    await conversation.delete();
  }
};

export const cancelGemma = () => {
  activeConversation?.cancel();
};

export const unloadGemma = async () => {
  activeConversation?.cancel();
  if (engine) await engine.delete();
  activeConversation = null;
  engine = null;
};
