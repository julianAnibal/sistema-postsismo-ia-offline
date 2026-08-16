import type { FieldSyncBatch } from "@/lib/api/field-sync-contracts";
import { InternalApiHttpError } from "@/lib/api/internal-response";
import {
  getFieldStorageConfigurationError,
  withFieldStorageClient,
  withFieldStorageTransaction,
} from "@/lib/data/field-storage";

const DEVICE_HASH_REGEX = /^[a-f0-9]{64}$/i;

function normalizeDeviceHash(hash: string) {
  return hash.trim().toLowerCase();
}

function ensureConfigured() {
  const error = getFieldStorageConfigurationError();
  if (error) {
    throw new InternalApiHttpError(
      503,
      "internal_data_unavailable",
      "Field synchronization storage is not configured.",
    );
  }
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof InternalApiHttpError) throw error;
  throw new InternalApiHttpError(
    503,
    "internal_data_unavailable",
    "Field synchronization storage rejected the batch.",
  );
}

export async function storeFieldSyncBatch(batch: FieldSyncBatch) {
  ensureConfigured();
  const deviceHash = normalizeDeviceHash(batch.deviceIdHash);
  if (!DEVICE_HASH_REGEX.test(deviceHash)) {
    throw new InternalApiHttpError(400, "invalid_query", "deviceIdHash is not a SHA-256 hex string.");
  }

  try {
    const result = await withFieldStorageTransaction(async (client) => {
      const deviceLookup = await client.query<{ status: string }>(
        `select status from field_devices where device_id_hash = $1`,
        [deviceHash],
      );
      const deviceRecord = deviceLookup.rows[0];
      if (deviceRecord?.status === "revoked") {
        throw new InternalApiHttpError(
          403,
          "internal_api_unauthorized",
          "This field device has been revoked.",
        );
      }

      await client.query(
        `insert into field_devices (device_id_hash, status, first_seen_at, last_seen_at)
         values ($1, 'active', now(), now())
         on conflict (device_id_hash) do update set last_seen_at = excluded.last_seen_at`,
        [deviceHash],
      );

      const batchInsert = await client.query<{ batch_id: string }>(
        `insert into field_sync_batches (
           batch_id, operation_id, device_id_hash, created_at_device,
           inspection_count, media_count, payload
         ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
         on conflict (batch_id) do nothing
         returning batch_id`,
        [
          batch.batchId,
          batch.operationId,
          deviceHash,
          new Date(batch.createdAt).toISOString(),
          batch.inspections.length,
          batch.media.length,
          JSON.stringify(batch),
        ],
      );

      const storedNow = (batchInsert.rowCount ?? 0) > 0;

      if (!storedNow) {
        const replayLookup = await client.query<{ matches: boolean }>(
          `select (
             operation_id = $2
             and device_id_hash = $3
             and payload = $4::jsonb
           ) as matches
           from field_sync_batches
           where batch_id = $1`,
          [batch.batchId, batch.operationId, deviceHash, JSON.stringify(batch)],
        );
        if (replayLookup.rows[0]?.matches !== true) {
          throw new InternalApiHttpError(
            409,
            "invalid_query",
            "Batch ID conflicts with a previously received payload.",
          );
        }
      }

      await client.query(
        `insert into field_audit_log (device_id_hash, action, entity_id, details)
         values ($1, $2, $3, $4::jsonb)`,
        [
          deviceHash,
          storedNow ? "field_batch_received" : "field_batch_replay",
          batch.batchId,
          JSON.stringify({
            operationId: batch.operationId,
            inspections: batch.inspections.length,
            media: batch.media.length,
            replay: !storedNow,
          }),
        ],
      );

      return {
        status: storedNow ? ("accepted" as const) : ("already_received" as const),
      };
    });

    return {
      batchId: batch.batchId,
      status: result.status,
      inspectionCount: batch.inspections.length,
      mediaCount: batch.media.length,
      mediaPendingUpload: batch.media
        .filter((item) => !item.objectKey)
        .map((item) => item.id),
    };
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function lookupDeviceStatus(deviceIdHash: string) {
  ensureConfigured();
  const deviceHash = normalizeDeviceHash(deviceIdHash);
  if (!DEVICE_HASH_REGEX.test(deviceHash)) {
    return { status: "unknown" as const };
  }
  try {
    return await withFieldStorageClient(async (client) => {
      const result = await client.query<{ status: string }>(
        `select status from field_devices where device_id_hash = $1`,
        [deviceHash],
      );
      const status = result.rows[0]?.status;
      if (status === "active") return { status: "active" as const };
      if (status === "revoked") return { status: "revoked" as const };
      return { status: "unknown" as const };
    });
  } catch {
    return { status: "unknown" as const };
  }
}
