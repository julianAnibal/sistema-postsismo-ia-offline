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
  mimeType: string;
  width: number;
  height: number;
  capturedAt: string;
  provenance: 'camera' | 'library';
  immutable: true;
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

export interface AppState {
  schemaVersion: 1;
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
