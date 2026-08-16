export type InfrastructureType =
  | 'residential'
  | 'education'
  | 'health'
  | 'bridge'
  | 'community'
  | 'warehouse';

export type Priority = 'critical' | 'high' | 'normal';
export type InspectionStatus = 'draft' | 'reviewed';
export type AccessLevel = 'accessible' | 'limited' | 'inaccessible' | 'unknown';
export type ObservationState =
  | 'damage_observed'
  | 'no_damage_observed'
  | 'not_observed'
  | 'unknown';
export type DamageLevel = 'none' | 'light' | 'moderate' | 'severe' | 'unknown';
export type StructuralElement =
  | 'wall'
  | 'column'
  | 'beam'
  | 'slab'
  | 'roof'
  | 'foundation'
  | 'nonstructural'
  | 'unknown';
export type VisualCondition =
  | 'none'
  | 'crack'
  | 'spalling'
  | 'deformation'
  | 'partial_collapse'
  | 'moisture'
  | 'other';
export type Observability = 'good' | 'partial' | 'poor';
export type ViewType = 'context' | 'exterior' | 'interior' | 'detail';
export type NeedType = 'medical' | 'shelter' | 'water' | 'accessibility';

export interface Infrastructure {
  id: string;
  code: string;
  name: string;
  type: InfrastructureType;
  sector: string;
  priority: Priority;
  gridCell: string;
  gridX: number;
  gridY: number;
  latitude: number;
  longitude: number;
  coordinatesAreSynthetic: true;
}

export interface Inspection {
  id: string;
  infrastructureId: string;
  status: InspectionStatus;
  access: AccessLevel;
  observation: ObservationState;
  damageLevel: DamageLevel;
  element: StructuralElement;
  condition: VisualCondition;
  observability: Observability;
  viewType: ViewType;
  notes: string;
  estimatedOccupants: number;
  peopleNeedingSupport: number;
  needs: NeedType[];
  mediaIds: string[];
  updatedAt: string;
  reviewedAt?: string;
}

export interface MediaEvidence {
  id: string;
  inspectionId: string;
  uri: string;
  sha256: string;
  sizeBytes: number;
  storage: 'app-file' | 'inline-web';
  capturePreflight: CapturePreflight;
  captureQuality: CaptureQualityMeasurement;
  mimeType: string;
  width: number;
  height: number;
  capturedAt: string;
  provenance: 'camera' | 'library';
  sensorMetadata: EvidenceSensorMetadata;
  integrity: EvidenceIntegrity;
  immutable: true;
}

export type EvidenceIntegrityReason =
  | 'not_checked'
  | 'file_missing'
  | 'uri_not_allowlisted'
  | 'inline_data_invalid'
  | 'mime_mismatch'
  | 'sha256_mismatch'
  | 'size_mismatch'
  | 'read_failed';

export type EvidenceIntegrity =
  | {
      status: 'verified';
      checkedAt: string;
      actualSha256: string;
    }
  | {
      status: 'unverified' | 'missing' | 'tampered';
      checkedAt: string;
      reason: EvidenceIntegrityReason;
      actualSha256?: string;
    };

export type CaptureQualitySignal =
  | 'nearly_all_dark'
  | 'nearly_all_bright'
  | 'nearly_uniform';

export interface CaptureQualityMetrics {
  meanLuminance: number;
  luminanceStandardDeviation: number;
  lowClipFraction: number;
  highClipFraction: number;
  p01Luminance: number;
  p99Luminance: number;
  entropyBits: number;
  laplacianVariance: number;
}

interface CaptureQualityMeasurementBase {
  schemaVersion: 1;
  checkedAt: string;
  modelUsed: false;
  networkRequired: false;
  releaseStatus: 'shadow';
  scope: 'extreme-pixel-proxy-v1';
}

export type CaptureQualityMeasurement =
  | (CaptureQualityMeasurementBase & {
      status: 'measured';
      proxy: {
        width: number;
        height: number;
        encodedBytes: number;
        decodedBytes: number;
        accountedBufferBytes: number;
      };
      metrics: CaptureQualityMetrics;
      signalIds: CaptureQualitySignal[];
      processingMilliseconds: number;
    })
  | (CaptureQualityMeasurementBase & {
      status: 'unsupported' | 'error';
      reason:
        | 'web_memory_guard'
        | 'native_proxy_unavailable'
        | 'input_rejected'
        | 'out_of_memory'
        | 'proxy_failed'
        | 'legacy_not_measured';
    });

export interface CapturePreflight {
  status: 'pass' | 'review';
  checkedAt: string;
  scope: 'metadata-only';
  issueIds: Array<'dimensions_unknown' | 'resolution_low' | 'aspect_extreme' | 'file_suspiciously_small'>;
}

export type SensorCaptureStatus = 'captured' | 'denied' | 'unavailable' | 'error';

export interface EvidenceSensorMetadata {
  recordedAt: string;
  location: {
    status: SensorCaptureStatus;
    timestamp?: number;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number | null;
    altitudeMeters?: number | null;
    altitudeAccuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedMetersPerSecond?: number | null;
    mocked?: boolean;
  };
  motion: {
    status: SensorCaptureStatus;
    intervalMs?: number;
    orientationDegrees?: number;
    acceleration?: { x: number; y: number; z: number; timestamp: number } | null;
    accelerationIncludingGravity?: { x: number; y: number; z: number; timestamp: number };
    rotation?: { alpha: number; beta: number; gamma: number; timestamp: number };
    rotationRate?: { alpha: number; beta: number; gamma: number; timestamp: number } | null;
  };
  device: {
    manufacturer: string | null;
    modelName: string | null;
    osName: string | null;
    osVersion: string | null;
    isDevice: boolean;
    totalMemoryBytes: number | null;
    supportedCpuArchitectures: string[];
  };
  exif: Record<string, unknown> | null;
}

export interface EvidenceAnnotation {
  id: string;
  mediaId: string;
  source: 'manual';
  element: StructuralElement;
  condition: VisualCondition;
  observability: Observability;
  viewType: ViewType;
  createdAt: string;
}

export interface ModelAnalysis {
  id: string;
  mediaId: string;
  modelId: string;
  modelSha256: string;
  createdAt: string;
  status: 'suggestion';
}

export interface OutboxItem {
  id: string;
  entityType: 'inspection' | 'media' | 'annotation';
  entityId: string;
  operation: 'upsert';
  createdAt: string;
  status: 'pending';
}

export interface OutboxAcknowledgement {
  outboxId: string;
  entityId: string;
  createdAt: string;
}

export interface AppState {
  schemaVersion: 2;
  operationName: string;
  deviceAlias: string;
  infrastructures: Infrastructure[];
  inspections: Inspection[];
  media: MediaEvidence[];
  annotations: EvidenceAnnotation[];
  modelAnalyses: ModelAnalysis[];
  outbox: OutboxItem[];
}

export interface KnowledgeSource {
  id: string;
  title: string;
  section: string;
  url: string;
  corpusStatus: 'prototype_seed' | 'approved';
  version: string;
  text: string;
  keywords: string[];
}

export type MapLayer = 'coverage' | 'reviewed_damage' | 'pending_ai' | 'needs';

export interface GridMetric {
  cellId: string;
  x: number;
  y: number;
  infrastructureCount: number;
  numerator: number;
  denominator: number;
  value: number | null;
  label: string;
}
