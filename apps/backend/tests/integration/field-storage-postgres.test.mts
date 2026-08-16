import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, test } from "node:test";

import type { FieldSyncBatch } from "../../src/lib/api/field-sync-contracts.js";
import { InternalApiHttpError } from "../../src/lib/api/internal-response.js";
import {
  getFieldMedia,
  listFieldObservations,
  saveFieldReview,
  storeFieldMedia,
} from "../../src/lib/data/field-observations.js";
import {
  closeFieldStorage,
  runFieldStorageMigrations,
  withFieldStorageClient,
} from "../../src/lib/data/field-storage.js";
import { storeFieldSyncBatch } from "../../src/lib/data/field-sync-data.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const mediaDir = process.env.TEST_FIELD_MEDIA_DIR;

after(async () => {
  await closeFieldStorage();
});

test("field intake persists, retries, reviews, media, and revocation in PostgreSQL", {
  skip: !databaseUrl || !mediaDir,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.FIELD_MEDIA_DIR = mediaDir;

  await runFieldStorageMigrations();

  const suffix = `${Date.now()}`;
  const batchId = `batch-integration-${suffix}`;
  const operationId = `operation-integration-${suffix}`;
  const inspectionId = `inspection-integration-${suffix}`;
  const mediaId = `media-integration-${suffix}`;
  const deviceIdHash = "a".repeat(64);
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const batch: FieldSyncBatch = {
    schemaVersion: 1,
    batchId,
    operationId,
    deviceIdHash,
    createdAt: "2026-08-16T12:00:00.000Z",
    infrastructures: [{
      id: `infrastructure-${suffix}`,
      code: `INT-${suffix}`,
      name: "Infraestructura sintética de integración",
      type: "community",
      sector: "Prueba",
      latitude: 4.7,
      longitude: -74.1,
      coordinatesAreSynthetic: true,
    }],
    inspections: [{
      id: inspectionId,
      infrastructureId: `infrastructure-${suffix}`,
      status: "reviewed",
      access: "accessible",
      observation: "damage_observed",
      damageLevel: "light",
      element: "wall",
      condition: "crack",
      observability: "good",
      viewType: "detail",
      notes: "Registro sintético; no es evidencia real.",
      estimatedOccupants: 0,
      peopleNeedingSupport: 0,
      needs: [],
      mediaIds: [mediaId],
      updatedAt: "2026-08-16T12:00:00.000Z",
      reviewedAt: "2026-08-16T12:00:00.000Z",
    }],
    media: [{
      id: mediaId,
      inspectionId,
      sha256,
      mimeType: "image/png",
      width: 1,
      height: 1,
      capturedAt: "2026-08-16T12:00:00.000Z",
      provenance: "camera",
      sensorMetadata: {
        recordedAt: "2026-08-16T12:00:00.000Z",
        location: { status: "unavailable" },
        motion: { status: "unavailable" },
        device: {
          manufacturer: null,
          modelName: null,
          osName: null,
          osVersion: null,
          isDevice: false,
        },
        exif: null,
      },
    }],
    annotations: [],
  };

  assert.equal((await storeFieldSyncBatch(batch)).status, "accepted");
  assert.equal((await storeFieldSyncBatch(batch)).status, "already_received");
  await assert.rejects(
    () => storeFieldSyncBatch({ ...batch, operationId: `${operationId}-conflict` }),
    (error: unknown) => error instanceof InternalApiHttpError && error.status === 409,
  );

  const firstMedia = await storeFieldMedia({
    operationId,
    batchId,
    mediaId,
    sha256,
    mimeType: "image/png",
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  assert.equal(firstMedia.status, "stored");
  const replayedMedia = await storeFieldMedia({
    operationId,
    batchId,
    mediaId,
    sha256,
    mimeType: "image/png",
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  assert.equal(replayedMedia.status, "already_stored");

  const retrievedMedia = await getFieldMedia({ batchId, mediaId });
  assert.equal(retrievedMedia.mimeType, "image/png");
  assert.equal(retrievedMedia.sha256, sha256);
  assert.deepEqual(Buffer.from(retrievedMedia.body), bytes);

  const observations = await listFieldObservations(operationId);
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.id, inspectionId);
  assert.equal(observations[0]?.mediaCount, 1);
  assert.equal(observations[0]?.mediaExpectedCount, 1);
  assert.equal(observations[0]?.media[0]?.id, mediaId);
  assert.equal(observations[0]?.review, null);

  const review = await saveFieldReview({ batchId, inspectionId, decision: "approved" });
  assert.equal(review.decision, "approved");
  const reviewedObservations = await listFieldObservations(operationId);
  assert.equal(reviewedObservations[0]?.review?.decision, "approved");
  await assert.rejects(
    () => saveFieldReview({ batchId, inspectionId: "not-in-batch", decision: "rejected" }),
    (error: unknown) => error instanceof InternalApiHttpError && error.status === 404,
  );

  const counts = await withFieldStorageClient(async (client) => {
    const media = await client.query<{ count: string }>(
      "select count(*)::text as count from field_media where batch_id = $1",
      [batchId],
    );
    const reviews = await client.query<{ count: string }>(
      "select count(*)::text as count from field_reviews where batch_id = $1",
      [batchId],
    );
    await client.query(
      "update field_devices set status = 'revoked', revoked_at = now() where device_id_hash = $1",
      [deviceIdHash],
    );
    return { media: media.rows[0]?.count, reviews: reviews.rows[0]?.count };
  });
  assert.deepEqual(counts, { media: "1", reviews: "1" });

  await assert.rejects(
    () => storeFieldSyncBatch({ ...batch, batchId: `${batchId}-revoked` }),
    (error: unknown) => error instanceof InternalApiHttpError && error.status === 403,
  );
});
