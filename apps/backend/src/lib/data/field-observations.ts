import { createHash } from "node:crypto";
import { InternalApiHttpError } from "@/lib/api/internal-response";
import {
  getFieldStorageConfigurationError,
  readFieldMediaFromDisk,
  storeFieldMediaOnDisk,
  withFieldStorageClient,
  withFieldStorageTransaction,
} from "@/lib/data/field-storage";

const MAX_MEDIA_BYTES = 15_000_000;

function ensureConfigured() {
  const error = getFieldStorageConfigurationError();
  if (error) {
    throw new InternalApiHttpError(
      503,
      "internal_data_unavailable",
      "Field storage is not configured. Set DATABASE_URL.",
    );
  }
}

function asDeviceHash(hash: string) {
  return hash.trim().toLowerCase();
}

function recordError(error: unknown): never {
  if (error instanceof InternalApiHttpError) throw error;
  throw new InternalApiHttpError(
    503,
    "internal_data_unavailable",
    "Field storage request failed.",
  );
}

type BatchRow = {
  batch_id: string;
  operation_id: string;
  received_at: Date;
  processing_status: string;
  payload: {
    infrastructures?: Array<Record<string, unknown>>;
    inspections?: Array<Record<string, unknown>>;
    media?: Array<Record<string, unknown>>;
  };
};

type MediaRow = {
  media_id: string;
  batch_id: string;
  sha256: string;
  mime_type: string;
  byte_size: string;
  storage_path: string;
  uploaded_at: Date;
};

type ReviewRow = {
  batch_id: string;
  inspection_id: string;
  decision: string;
  corrected_damage_level: string | null;
  notes: string;
  reviewed_at: Date;
};

export async function listFieldObservations(operationId?: string) {
  ensureConfigured();
  try {
    return await withFieldStorageClient(async (client) => {
      const query = operationId
        ? client.query<BatchRow>(
            `select batch_id, operation_id, received_at, processing_status, payload
             from field_sync_batches
             where operation_id = $1
             order by received_at desc
             limit 250`,
            [operationId],
          )
        : client.query<BatchRow>(
            `select batch_id, operation_id, received_at, processing_status, payload
             from field_sync_batches
             order by received_at desc
             limit 250`,
          );
      const batches = (await query).rows;

      const batchIds = batches.map((batch) => batch.batch_id);
      const mediaRows = batchIds.length > 0
        ? (await client.query<MediaRow>(
            `select media_id, batch_id, sha256, mime_type, byte_size::text, storage_path, uploaded_at
             from field_media
             where batch_id = any($1::text[])
             order by uploaded_at asc`,
            [batchIds],
          )).rows
        : [];
      const reviewRows = batchIds.length > 0
        ? (await client.query<ReviewRow>(
            `select batch_id, inspection_id, decision, corrected_damage_level, notes, reviewed_at
             from field_reviews
             where batch_id = any($1::text[])`,
            [batchIds],
          )).rows
        : [];

      const mediaByBatch = new Map<string, Map<string, MediaRow>>();
      for (const row of mediaRows) {
        const batchMedia = mediaByBatch.get(row.batch_id) ?? new Map<string, MediaRow>();
        batchMedia.set(row.media_id, row);
        mediaByBatch.set(row.batch_id, batchMedia);
      }
      const reviewsByInspection = new Map(
        reviewRows.map((row) => [`${row.batch_id}:${row.inspection_id}`, row] as const),
      );

      const observations = batches.flatMap((batch) => {
        const infrastructures = batch.payload.infrastructures ?? [];
        const inspections = batch.payload.inspections ?? [];
        const declaredMedia = batch.payload.media ?? [];
        const uploadedMedia = mediaByBatch.get(batch.batch_id) ?? new Map<string, MediaRow>();
        return inspections.map((inspection) => {
          const inspectionId = String(inspection.id);
          const infrastructure = infrastructures.find((item) => item.id === inspection.infrastructureId);
          const inspectionMedia = declaredMedia.flatMap((item) => {
            if (item.inspectionId !== inspectionId || typeof item.id !== "string") return [];
            const uploaded = uploadedMedia.get(item.id);
            if (!uploaded) return [];
            const query = new URLSearchParams({ batch_id: batch.batch_id, media_id: item.id });
            return [{
              id: item.id,
              sha256: uploaded.sha256,
              mimeType: uploaded.mime_type,
              byteSize: Number(uploaded.byte_size),
              uploadedAt: uploaded.uploaded_at.toISOString(),
              capturedAt: typeof item.capturedAt === "string" ? item.capturedAt : null,
              provenance: typeof item.provenance === "string" ? item.provenance : null,
              href: `/api/internal/v1/field-media?${query.toString()}`,
            }];
          });
          const review = reviewsByInspection.get(`${batch.batch_id}:${inspectionId}`);
          return {
            id: inspectionId,
            batchId: batch.batch_id,
            operationId: batch.operation_id,
            receivedAt: batch.received_at.toISOString(),
            processingStatus: batch.processing_status,
            infrastructure,
            inspection,
            media: inspectionMedia,
            mediaCount: inspectionMedia.length,
            mediaExpectedCount: declaredMedia.filter((item) => item.inspectionId === inspectionId).length,
            review: review ? {
              decision: review.decision,
              correctedDamageLevel: review.corrected_damage_level,
              notes: review.notes,
              reviewedAt: review.reviewed_at.toISOString(),
            } : null,
            sourceRole: "field-evidence-pending-review",
          };
        });
      });

      return observations;
    });
  } catch (error) {
    recordError(error);
  }
}

export async function getFieldMedia(input: { batchId: string; mediaId: string }) {
  ensureConfigured();
  try {
    const row = await withFieldStorageClient(async (client) => {
      const result = await client.query<MediaRow>(
        `select media_id, batch_id, sha256, mime_type, byte_size::text, storage_path, uploaded_at
         from field_media
         where batch_id = $1 and media_id = $2`,
        [input.batchId, input.mediaId],
      );
      return result.rows[0] ?? null;
    });
    if (!row) {
      throw new InternalApiHttpError(404, "invalid_query", "Field media was not found.");
    }

    const bytes = await readFieldMediaFromDisk(row.storage_path);
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== Number(row.byte_size) || actualSha256 !== row.sha256) {
      throw new InternalApiHttpError(
        503,
        "internal_data_unavailable",
        "Stored field media failed integrity verification.",
      );
    }

    return {
      body: bytes,
      mimeType: row.mime_type,
      byteSize: bytes.byteLength,
      sha256: row.sha256,
    };
  } catch (error) {
    recordError(error);
  }
}

export async function saveFieldReview(input: {
  inspectionId: string;
  batchId: string;
  decision: "approved" | "corrected" | "rejected";
  correctedDamageLevel?: string;
  notes?: string;
}) {
  ensureConfigured();
  try {
    return await withFieldStorageTransaction(async (client) => {
      const batchLookup = await client.query<{
        batch_id: string;
        device_id_hash: string;
        payload: { inspections?: Array<{ id?: unknown }> };
      }>(
        `select batch_id, device_id_hash, payload
         from field_sync_batches
         where batch_id = $1`,
        [input.batchId],
      );
      if ((batchLookup.rowCount ?? 0) === 0) {
        throw new InternalApiHttpError(404, "invalid_query", "Referenced batch does not exist.");
      }
      const inspections = batchLookup.rows[0].payload?.inspections;
      if (!Array.isArray(inspections) || !inspections.some((item) => item.id === input.inspectionId)) {
        throw new InternalApiHttpError(404, "invalid_query", "Referenced inspection does not exist in this batch.");
      }

      const result = await client.query<{
        id: string;
        batch_id: string;
        inspection_id: string;
        decision: string;
        corrected_damage_level: string | null;
        notes: string;
        reviewed_at: Date;
      }>(
        `insert into field_reviews (
           batch_id, inspection_id, decision, corrected_damage_level, notes
         ) values ($1, $2, $3, $4, $5)
         on conflict (batch_id, inspection_id) do update
           set decision = excluded.decision,
               corrected_damage_level = excluded.corrected_damage_level,
               notes = excluded.notes,
               reviewed_at = now()
         returning id, batch_id, inspection_id, decision, corrected_damage_level, notes, reviewed_at`,
        [
          input.batchId,
          input.inspectionId,
          input.decision,
          input.correctedDamageLevel ?? null,
          input.notes ?? "",
        ],
      );

      const row = result.rows[0];
      await client.query(
        `insert into field_audit_log (device_id_hash, action, entity_id, details)
         values ($1, $2, $3, $4::jsonb)`,
        [
          asDeviceHash(batchLookup.rows[0].device_id_hash),
          "field_review_saved",
          `${input.batchId}:${input.inspectionId}`,
          JSON.stringify({
            decision: input.decision,
            correctedDamageLevel: input.correctedDamageLevel ?? null,
          }),
        ],
      );

      return {
        id: row.id,
        batchId: row.batch_id,
        inspectionId: row.inspection_id,
        decision: row.decision,
        correctedDamageLevel: row.corrected_damage_level,
        notes: row.notes,
        reviewedAt: row.reviewed_at.toISOString(),
      };
    });
  } catch (error) {
    recordError(error);
  }
}

function extensionForMimeType(mimeType: string): "jpg" | "png" | "webp" | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export async function storeFieldMedia(input: {
  operationId: string;
  batchId: string;
  mediaId: string;
  sha256: string;
  mimeType: string;
  body: ArrayBuffer;
}) {
  ensureConfigured();
  if (input.body.byteLength === 0 || input.body.byteLength > MAX_MEDIA_BYTES) {
    throw new InternalApiHttpError(413, "invalid_query", "Media file is empty or too large.");
  }
  const extension = extensionForMimeType(input.mimeType);
  if (!extension) {
    throw new InternalApiHttpError(400, "invalid_query", "Unsupported media content type.");
  }

  try {
    const batch = await withFieldStorageClient(async (client) => {
      const lookup = await client.query<{
        operation_id: string;
        device_id_hash: string;
        payload: { media?: Array<{ id?: unknown; sha256?: unknown; mimeType?: unknown }> };
      }>(
        `select operation_id, device_id_hash, payload
         from field_sync_batches
         where batch_id = $1`,
        [input.batchId],
      );
      return lookup.rows[0] ?? null;
    });
    if (!batch) {
      throw new InternalApiHttpError(404, "invalid_query", "Referenced batch does not exist for media upload.");
    }
    if (batch.operation_id !== input.operationId) {
      throw new InternalApiHttpError(409, "invalid_query", "Media operation does not match its batch.");
    }
    const declaredMedia = batch.payload?.media;
    const media = Array.isArray(declaredMedia)
      ? declaredMedia.find((item) => item.id === input.mediaId)
      : undefined;
    if (!media) {
      throw new InternalApiHttpError(404, "invalid_query", "Media ID is not declared by this batch.");
    }
    if (
      String(media.sha256).toLowerCase() !== input.sha256.toLowerCase()
      || media.mimeType !== input.mimeType
    ) {
      throw new InternalApiHttpError(409, "invalid_query", "Media metadata does not match its batch.");
    }

    const stored = await storeFieldMediaOnDisk({
      operationId: input.operationId,
      batchId: input.batchId,
      mediaId: input.mediaId,
      sha256: input.sha256,
      body: input.body,
      extension,
    });

    await withFieldStorageTransaction(async (client) => {
      const batchLookup = await client.query<{ batch_id: string; device_id_hash: string }>(
        `select batch_id, device_id_hash from field_sync_batches where batch_id = $1`,
        [input.batchId],
      );
      if ((batchLookup.rowCount ?? 0) === 0) {
        throw new InternalApiHttpError(404, "invalid_query", "Referenced batch does not exist for media upload.");
      }

      const mediaInsert = await client.query(
        `insert into field_media (
           media_id, operation_id, batch_id, sha256, mime_type, byte_size, storage_path
         ) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (batch_id, media_id) do nothing
         returning media_id`,
        [
          input.mediaId,
          input.operationId,
          input.batchId,
          stored.sha256,
          input.mimeType,
          stored.bytes,
          stored.storagePath,
        ],
      );
      const recordedNow = (mediaInsert.rowCount ?? 0) > 0;

      await client.query(
        `insert into field_audit_log (device_id_hash, action, entity_id, details)
         values ($1, $2, $3, $4::jsonb)`,
        [
          asDeviceHash(batchLookup.rows[0].device_id_hash),
          recordedNow ? "field_media_received" : "field_media_dedup",
          input.mediaId,
          JSON.stringify({
            operationId: input.operationId,
            sha256: stored.sha256,
            bytes: stored.bytes,
            mimeType: input.mimeType,
            status: recordedNow ? stored.status : "already_stored",
          }),
        ],
      );
    });

    return { objectKey: stored.objectKey, sha256: stored.sha256, status: stored.status };
  } catch (error) {
    recordError(error);
  }
}
