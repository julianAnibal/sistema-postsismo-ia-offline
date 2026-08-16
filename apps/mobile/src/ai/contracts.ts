import { KnowledgeSource } from '../domain/types';

export type LocalModelTask =
  | 'capture-quality'
  | 'visible-condition-segmentation'
  | 'language-drafting';

export interface ModelEvaluationEvidence {
  metric: string;
  value: number;
  datasetReleaseId: string;
  reportSha256: string;
  reportPath: string;
}

export interface ModelPackManifest {
  manifestVersion: 1;
  id: string;
  version: string;
  runtime: 'onnx-runtime-mobile' | 'litert-lm';
  task: LocalModelTask | null;
  sha256: string;
  sizeBytes: number;
  minimumMemoryBytes: number;
  estimatedPeakMemoryBytes: number;
  minimumFreeStorageBytes: number;
  supportedCpuArchitectures: string[];
  released: boolean;
  status: 'unreleased' | 'released';
  evaluation?: ModelEvaluationEvidence;
  licenseNoticePath: string;
}

export interface VisionInput {
  mediaId: string;
  imageUri: string;
  width: number;
  height: number;
}

export interface VisionSuggestion {
  modelId: string;
  modelSha256: string;
  classId: string;
  confidence: number;
  maskUri?: string;
}

export interface LocalVisionEngine {
  capability(): Promise<'ready' | 'not_installed' | 'unsupported'>;
  analyze(input: VisionInput): Promise<VisionSuggestion[]>;
}

export interface AssistantRequest {
  question: string;
  context: string;
  sources: KnowledgeSource[];
}

export interface AssistantDraft {
  text: string;
  modelId: string;
  modelSha256: string;
  sourceIds: string[];
}

export interface LocalLanguageEngine {
  capability(): Promise<'ready' | 'not_installed' | 'unsupported'>;
  draft(request: AssistantRequest): Promise<AssistantDraft>;
}
