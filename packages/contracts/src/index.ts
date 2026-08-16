import { z } from "zod";

const IsoDateSchema = z.string().datetime({ offset: true });
const IdSchema = z.string().trim().min(1).max(128);

const SensorStatusSchema = z.enum(["captured", "denied", "unavailable", "error"]);

const LocationSchema = z.object({
  status: SensorStatusSchema,
  timestamp: z.number().finite().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().nonnegative().nullable().optional(),
  altitudeMeters: z.number().finite().nullable().optional(),
  altitudeAccuracyMeters: z.number().nonnegative().nullable().optional(),
  headingDegrees: z.number().min(0).max(360).nullable().optional(),
  speedMetersPerSecond: z.number().nonnegative().nullable().optional(),
  mocked: z.boolean().optional(),
}).superRefine((location, context) => {
  if (location.status !== "captured") return;
  if (location.latitude === undefined || location.longitude === undefined) {
    context.addIssue({
      code: "custom",
      message: "Captured location requires latitude and longitude.",
    });
  }
});

const VectorSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  timestamp: z.number().finite(),
});

const RotationSchema = z.object({
  alpha: z.number().finite(),
  beta: z.number().finite(),
  gamma: z.number().finite(),
  timestamp: z.number().finite(),
});

const SensorMetadataSchema = z.object({
  recordedAt: IsoDateSchema,
  location: LocationSchema,
  motion: z.object({
    status: SensorStatusSchema,
    intervalMs: z.number().positive().optional(),
    orientationDegrees: z.number().finite().optional(),
    acceleration: VectorSchema.nullable().optional(),
    accelerationIncludingGravity: VectorSchema.optional(),
    rotation: RotationSchema.optional(),
    rotationRate: RotationSchema.nullable().optional(),
  }),
  device: z.object({
    manufacturer: z.string().max(120).nullable(),
    modelName: z.string().max(120).nullable(),
    osName: z.string().max(80).nullable(),
    osVersion: z.string().max(80).nullable(),
    isDevice: z.boolean(),
  }),
  exif: z.record(z.string(), z.unknown()).nullable(),
});

export const FieldSyncBatchSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: IdSchema,
  operationId: IdSchema,
  deviceIdHash: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: IsoDateSchema,
  infrastructures: z.array(z.object({
    id: IdSchema,
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(240),
    type: z.enum(["residential", "education", "health", "bridge", "community", "warehouse"]),
    sector: z.string().trim().max(160),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    coordinatesAreSynthetic: z.boolean(),
  })).max(500),
  inspections: z.array(z.object({
    id: IdSchema,
    infrastructureId: IdSchema,
    status: z.enum(["draft", "reviewed"]),
    access: z.enum(["accessible", "limited", "inaccessible", "unknown"]),
    observation: z.enum(["damage_observed", "no_damage_observed", "not_observed", "unknown"]),
    damageLevel: z.enum(["none", "light", "moderate", "severe", "unknown"]),
    element: z.enum(["wall", "column", "beam", "slab", "roof", "foundation", "nonstructural", "unknown"]),
    condition: z.enum(["none", "crack", "spalling", "deformation", "partial_collapse", "moisture", "other"]),
    observability: z.enum(["good", "partial", "poor"]),
    viewType: z.enum(["context", "exterior", "interior", "detail"]),
    notes: z.string().max(4_000),
    estimatedOccupants: z.number().int().nonnegative().max(100_000),
    peopleNeedingSupport: z.number().int().nonnegative().max(100_000),
    needs: z.array(z.enum(["medical", "shelter", "water", "accessibility"])).max(4),
    mediaIds: z.array(IdSchema).max(100),
    updatedAt: IsoDateSchema,
    reviewedAt: IsoDateSchema.optional(),
  })).max(500),
  media: z.array(z.object({
    id: IdSchema,
    inspectionId: IdSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    width: z.number().int().positive().max(50_000),
    height: z.number().int().positive().max(50_000),
    capturedAt: IsoDateSchema,
    provenance: z.enum(["camera", "library"]),
    objectKey: z.string().trim().min(1).max(512).optional(),
    sensorMetadata: SensorMetadataSchema,
  })).max(1_000),
  annotations: z.array(z.object({
    id: IdSchema,
    mediaId: IdSchema,
    source: z.literal("manual"),
    element: z.enum(["wall", "column", "beam", "slab", "roof", "foundation", "nonstructural", "unknown"]),
    condition: z.enum(["none", "crack", "spalling", "deformation", "partial_collapse", "moisture", "other"]),
    observability: z.enum(["good", "partial", "poor"]),
    viewType: z.enum(["context", "exterior", "interior", "detail"]),
    createdAt: IsoDateSchema,
  })).max(1_000),
}).strict();

export type FieldSyncBatch = z.infer<typeof FieldSyncBatchSchema>;
