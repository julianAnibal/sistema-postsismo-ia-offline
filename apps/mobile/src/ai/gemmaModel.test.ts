import { describe, expect, it } from 'vitest';

import { AssistantRequest } from './contracts';
import {
  buildGemmaPrompt,
  GEMMA_ANDROID_E2B_MODEL,
  GEMMA_E2B_MODEL,
  isValidGemmaInstallMetadata,
} from './gemmaModel';

describe('Gemma 4 E2B web pack', () => {
  it('pins the exact official artifact revision, byte count and SHA-256', () => {
    expect(GEMMA_E2B_MODEL.fileName).toBe('gemma-4-E2B-it-web.litertlm');
    expect(GEMMA_E2B_MODEL.revision).toHaveLength(40);
    expect(GEMMA_E2B_MODEL.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(GEMMA_E2B_MODEL.sizeBytes).toBe(2_008_432_640);
    expect(GEMMA_E2B_MODEL.downloadUrl).toContain(GEMMA_E2B_MODEL.revision);
  });

  it('pins the compatible Android artifact separately from the web package', () => {
    expect(GEMMA_ANDROID_E2B_MODEL.fileName).toBe('gemma-4-E2B-it.litertlm');
    expect(GEMMA_ANDROID_E2B_MODEL.revision).toBe(GEMMA_E2B_MODEL.revision);
    expect(GEMMA_ANDROID_E2B_MODEL.sha256).toBe(
      '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
    );
    expect(GEMMA_ANDROID_E2B_MODEL.sizeBytes).toBe(2_588_147_712);
    expect(GEMMA_ANDROID_E2B_MODEL.runtime).toContain('litertlm-android:0.16.0');
    expect(GEMMA_ANDROID_E2B_MODEL.downloadUrl).toContain(
      GEMMA_ANDROID_E2B_MODEL.revision,
    );
  });

  it('fails closed when the stored file no longer matches its verified metadata', () => {
    const file = {
      size: GEMMA_E2B_MODEL.sizeBytes,
      lastModified: 42,
    } as File;
    const metadata = {
      schemaVersion: 1,
      modelId: GEMMA_E2B_MODEL.id,
      revision: GEMMA_E2B_MODEL.revision,
      fileName: GEMMA_E2B_MODEL.fileName,
      sizeBytes: GEMMA_E2B_MODEL.sizeBytes,
      sha256: GEMMA_E2B_MODEL.sha256,
      modelLastModified: 42,
      installedAt: '2026-08-16T00:00:00.000Z',
      source: 'network',
    };

    expect(isValidGemmaInstallMetadata(metadata, file)).toBe(true);
    expect(isValidGemmaInstallMetadata(metadata, { ...file, size: file.size - 1 })).toBe(false);
    expect(isValidGemmaInstallMetadata({ ...metadata, sha256: '0'.repeat(64) }, file)).toBe(false);
  });

  it('constrains the prompt to evidence-backed drafting with human review', () => {
    const request: AssistantRequest = {
      question: 'Ayúdame a redactar la observación.',
      context: 'Acceso no autorizado; observación exterior solamente.',
      sources: [],
    };
    const prompt = buildGemmaPrompt(request);

    expect(prompt).toContain(request.question);
    expect(prompt).toContain(request.context);
    expect(prompt).toContain('Revisión profesional obligatoria.');
    expect(prompt).toContain('Sin fuentes documentales recuperadas');
    expect(prompt).toContain('máximo de 130 palabras');
    expect(prompt).toContain('etiqueta manual');
  });
});
