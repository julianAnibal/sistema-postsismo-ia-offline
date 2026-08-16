import type { AppState } from './types';

export const buildRestrictedReducedExport = (
  state: AppState,
  exportedAt = new Date().toISOString(),
) => ({
  schemaVersion: state.schemaVersion,
  exportProfile: 'restricted-reduced-manifest-v1' as const,
  sensitivity: 'restricted-personal-and-operational-data' as const,
  intendedRecipient: 'authorized-response-operator' as const,
  exportedAt,
  operation: {
    name: state.operationName,
    deviceAlias: state.deviceAlias,
  },
  redactions: [
    'photo_binary_and_local_uri',
    'exact_infrastructure_coordinates_and_name',
    'free_text_notes',
    'exact_gps_and_motion_values',
    'exif_and_device_fingerprint',
    'model_output',
  ],
  retainedSensitiveFields: [
    'case_and_evidence_ids',
    'exact_timestamps_and_hashes',
    'occupant_and_support_counts',
    'needs_and_manual_annotations',
    'device_alias_and_outbox',
  ],
  infrastructures: state.infrastructures.map(({ id, code, type, priority }) => ({
    id,
    code,
    type,
    priority,
  })),
  inspections: state.inspections.map(({ notes: _notes, ...inspection }) => inspection),
  mediaManifest: state.media.map((item) => ({
    id: item.id,
    inspectionId: item.inspectionId,
    sha256: item.sha256,
    sizeBytes: item.sizeBytes,
    mimeType: item.mimeType,
    width: item.width,
    height: item.height,
    capturedAt: item.capturedAt,
    provenance: item.provenance,
    immutable: item.immutable,
    capturePreflight: item.capturePreflight,
    captureQuality: item.captureQuality,
    sensorAvailability: {
      location: item.sensorMetadata.location.status,
      motion: item.sensorMetadata.motion.status,
    },
    binaryIncluded: false as const,
  })),
  annotations: state.annotations,
  outbox: state.outbox,
});
