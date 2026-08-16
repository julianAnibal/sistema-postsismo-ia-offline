import { AssistantRequest } from './contracts';

export const GEMMA_E2B_MODEL = {
  id: 'litert-community/gemma-4-E2B-it-litert-lm',
  displayName: 'Gemma 4 E2B IT',
  revision: '6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94',
  fileName: 'gemma-4-E2B-it-web.litertlm',
  storageFileName: 'gemma-4-E2B-it-web.litertlm',
  metadataFileName: 'gemma-4-E2B-it-web.metadata.json',
  sizeBytes: 2_008_432_640,
  sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
  runtime: '@litert-lm/core@0.15.0',
  downloadUrl:
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94/gemma-4-E2B-it-web.litertlm',
  modelPageUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm',
  runtimeDocsUrl: 'https://github.com/google-ai-edge/litert-lm/tree/main/js/packages/core',
} as const;

export const GEMMA_ANDROID_E2B_MODEL = {
  id: 'litert-community/gemma-4-E2B-it-litert-lm',
  displayName: 'Gemma 4 E2B IT',
  revision: '6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94',
  fileName: 'gemma-4-E2B-it.litertlm',
  storageFileName: 'gemma-4-E2B-it.litertlm',
  sizeBytes: 2_588_147_712,
  sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
  runtime: 'com.google.ai.edge.litertlm:litertlm-android:0.16.0',
  downloadUrl:
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94/gemma-4-E2B-it.litertlm',
  modelPageUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm',
  runtimeDocsUrl:
    'https://github.com/google-ai-edge/LiteRT-LM/blob/v0.16.0/docs/api/kotlin/getting_started.md',
} as const;

export const GEMMA_SYSTEM_PROMPT = `Eres el asistente local de 1000 Ojos para documentación de campo postsismo.
Trabaja únicamente con los datos y fuentes incluidos en la solicitud. Ayuda a organizar observaciones, detectar campos faltantes y redactar borradores breves en español.
No declares diagnósticos estructurales, habitabilidad, estabilidad, seguridad, prioridad de triaje ni decisiones de autoridad. No inventes hechos, mediciones ni citas. Distingue lo observado de lo desconocido y marca cualquier inferencia como una pregunta para revisión profesional.
Conserva la procedencia: una "etiqueta manual" es un registro del inspector y no una observación independiente del modelo. No cambies su alcance ni la presentes como validada por IA.
Toda salida es un borrador que una persona autorizada debe revisar antes de usar.`;

export interface GemmaInstallMetadata {
  schemaVersion: 1;
  modelId: typeof GEMMA_E2B_MODEL.id;
  revision: typeof GEMMA_E2B_MODEL.revision;
  fileName: typeof GEMMA_E2B_MODEL.fileName;
  sizeBytes: typeof GEMMA_E2B_MODEL.sizeBytes;
  sha256: typeof GEMMA_E2B_MODEL.sha256;
  modelLastModified: number;
  installedAt: string;
  source: 'network' | 'local-file';
}

export const isValidGemmaInstallMetadata = (
  value: unknown,
  file: Pick<File, 'size' | 'lastModified'>,
): value is GemmaInstallMetadata => {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<GemmaInstallMetadata>;
  return (
    metadata.schemaVersion === 1 &&
    metadata.modelId === GEMMA_E2B_MODEL.id &&
    metadata.revision === GEMMA_E2B_MODEL.revision &&
    metadata.fileName === GEMMA_E2B_MODEL.fileName &&
    metadata.sizeBytes === GEMMA_E2B_MODEL.sizeBytes &&
    metadata.sha256 === GEMMA_E2B_MODEL.sha256 &&
    metadata.modelLastModified === file.lastModified &&
    file.size === GEMMA_E2B_MODEL.sizeBytes &&
    typeof metadata.installedAt === 'string' &&
    (metadata.source === 'network' || metadata.source === 'local-file')
  );
};

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max)}\n[contenido truncado localmente]`;

export const buildGemmaPrompt = (request: AssistantRequest) => {
  const sourceLines = request.sources.length
    ? request.sources
        .slice(0, 6)
        .map((source) => `- ${source.id}: ${truncate(source.title, 80)} (${source.version})`)
        .join('\n')
    : '- Sin fuentes documentales recuperadas';

  return `SOLICITUD DEL INSPECTOR
${truncate(request.question.trim(), 400)}

CONTEXTO DEL EXPEDIENTE
${truncate(request.context.trim(), 2_400)}

FUENTES DISPONIBLES
${sourceLines}

Responde en español con un máximo de 130 palabras y exactamente estas secciones: "Registros del inspector", "Faltantes" y "Borrador sugerido". No añadas listas de pendientes redundantes. Conserva explícitamente la expresión "etiqueta manual" cuando aparezca en el contexto. Termina con: "Revisión profesional obligatoria."`;
};

export const formatGemmaBytes = (bytes: number) => {
  const gib = bytes / 1024 ** 3;
  return `${gib.toFixed(2)} GiB`;
};
