import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { Pool, type PoolClient, type PoolConfig } from "pg";

export type FieldStorageConfigurationError = {
  kind: "configuration_error";
  message: string;
};

export type FieldStorageBackend = {
  pool: Pool;
  close: () => Promise<void>;
};

let cachedPool: Pool | null = null;
let cachedConfig: { connectionString: string } | null = null;

export function getFieldStorageConfigurationError(): FieldStorageConfigurationError | null {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return {
      kind: "configuration_error",
      message: "Field storage is not configured. Set DATABASE_URL.",
    };
  }
  return null;
}

function buildPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: false,
    application_name: "1000-ojos-field",
  };
}

export async function getFieldStorageBackend(): Promise<FieldStorageBackend> {
  const configurationError = getFieldStorageConfigurationError();
  if (configurationError) {
    throw configurationError;
  }
  const connectionString = process.env.DATABASE_URL!.trim();
  if (!cachedPool || !cachedConfig || cachedConfig.connectionString !== connectionString) {
    if (cachedPool) {
      await cachedPool.end().catch(() => undefined);
    }
    cachedPool = new Pool(buildPoolConfig(connectionString));
    cachedConfig = { connectionString };
  }
  return {
    pool: cachedPool,
    close: async () => {
      if (cachedPool) {
        await cachedPool.end().catch(() => undefined);
        cachedPool = null;
        cachedConfig = null;
      }
    },
  };
}

export async function withFieldStorageClient<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const backend = await getFieldStorageBackend();
  const client = await backend.pool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

export async function withFieldStorageTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withFieldStorageClient(async (client) => {
    await client.query("begin");
    try {
      const result = await handler(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

const MIGRATION_TABLE = "field_storage_migrations";

export const FIELD_STORAGE_MIGRATIONS: ReadonlyArray<{
  id: string;
  description: string;
  sql: string;
}> = [
  {
    id: "0002_field_sync_batches",
    description: "Create field sync batch, device, audit, and review tables.",
    sql: `
      create table if not exists field_sync_batches (
        batch_id text primary key,
        operation_id text not null,
        device_id_hash text not null check (device_id_hash ~ '^[0-9a-f]{64}$'),
        created_at_device timestamptz not null,
        received_at timestamptz not null default now(),
        inspection_count integer not null check (inspection_count >= 0),
        media_count integer not null check (media_count >= 0),
        processing_status text not null default 'received'
          check (processing_status in ('received', 'processing', 'processed', 'rejected')),
        payload jsonb not null,
        processing_error text
      );

      create table if not exists field_devices (
        device_id_hash text primary key check (device_id_hash ~ '^[0-9a-f]{64}$'),
        status text not null default 'active' check (status in ('active', 'revoked')),
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        revoked_at timestamptz
      );

      create table if not exists field_audit_log (
        id bigint generated always as identity primary key,
        device_id_hash text,
        action text not null,
        entity_id text,
        details jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create table if not exists field_reviews (
        id uuid primary key default gen_random_uuid(),
        batch_id text not null references field_sync_batches(batch_id) on delete cascade,
        inspection_id text not null,
        decision text not null check (decision in ('approved', 'corrected', 'rejected')),
        corrected_damage_level text check (corrected_damage_level in ('none', 'light', 'moderate', 'severe', 'unknown')),
        notes text not null default '',
        reviewed_at timestamptz not null default now(),
        unique (batch_id, inspection_id)
      );

      create table if not exists field_media (
        media_id text not null,
        operation_id text not null,
        batch_id text not null references field_sync_batches(batch_id) on delete cascade,
        sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
        mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
        byte_size bigint not null check (byte_size > 0 and byte_size <= 15728640),
        storage_path text not null,
        uploaded_at timestamptz not null default now(),
        primary key (batch_id, media_id)
      );

      create index if not exists field_sync_batches_operation_received_idx
        on field_sync_batches (operation_id, received_at desc);
      create index if not exists field_sync_batches_status_received_idx
        on field_sync_batches (processing_status, received_at);
      create index if not exists field_media_operation_idx
        on field_media (operation_id, uploaded_at desc);
      create index if not exists field_audit_log_device_idx
        on field_audit_log (device_id_hash, created_at desc);
    `,
  },
];

export async function runFieldStorageMigrations(client?: PoolClient): Promise<{
  applied: string[];
  alreadyApplied: string[];
}> {
  const execute = async (c: PoolClient) => {
    await c.query(`
      create table if not exists ${MIGRATION_TABLE} (
        id text primary key,
        description text not null,
        applied_at timestamptz not null default now()
      )
    `);
    const applied: string[] = [];
    const alreadyApplied: string[] = [];
    for (const migration of FIELD_STORAGE_MIGRATIONS) {
      const existing = await c.query<{ id: string }>(
        `select id from ${MIGRATION_TABLE} where id = $1`,
        [migration.id],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        alreadyApplied.push(migration.id);
        continue;
      }
      await c.query("begin");
      try {
        await c.query(migration.sql);
        await c.query(
          `insert into ${MIGRATION_TABLE} (id, description) values ($1, $2)`,
          [migration.id, migration.description],
        );
        await c.query("commit");
        applied.push(migration.id);
      } catch (error) {
        await c.query("rollback").catch(() => undefined);
        throw error;
      }
    }
    return { applied, alreadyApplied };
  };

  if (client) {
    return execute(client);
  }
  return withFieldStorageClient(execute);
}

export function resolveFieldMediaRoot(): string {
  const explicit = process.env.FIELD_MEDIA_DIR?.trim();
  if (explicit && !isAbsolute(explicit)) {
    throw new Error("FIELD_MEDIA_DIR must be an absolute path.");
  }
  if (explicit) {
    return explicit;
  }
  const volumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (volumeMount && !isAbsolute(volumeMount)) {
    throw new Error("RAILWAY_VOLUME_MOUNT_PATH must be an absolute path.");
  }
  if (volumeMount) {
    return join(volumeMount, "field-media");
  }
  if (process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID) {
    throw new Error("A Railway volume mount is required for field media.");
  }
  return resolve(process.cwd(), ".field-media");
}

function ensureWithinRoot(root: string, relativePath: string): string {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("Refusing empty media path.");
  }
  if (relativePath.split(/[/\\]+/).some((segment) => segment === "..")) {
    throw new Error("Refusing path that escapes the media root.");
  }
  const normalized = normalize(relativePath).replace(/^[/\\]+/, "");
  const segments = normalized.split(/[/\\]+/);
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error("Refusing path that escapes the media root.");
  }
  const absolute = resolve(root, ...segments);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (!absolute.startsWith(rootWithSep) && absolute !== root) {
    throw new Error("Refusing path that escapes the media root.");
  }
  return absolute;
}

function ensureAbsoluteWithinRoot(root: string, absolutePath: string): string {
  if (!isAbsolute(absolutePath)) {
    throw new Error("Stored media path must be absolute.");
  }
  const normalizedRoot = resolve(root);
  const normalizedPath = resolve(absolutePath);
  const rootWithSep = normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep;
  if (!normalizedPath.startsWith(rootWithSep)) {
    throw new Error("Refusing stored media path that escapes the media root.");
  }
  return normalizedPath;
}

export const __testing = { ensureWithinRoot, ensureAbsoluteWithinRoot };

export type StoredFieldMedia = {
  objectKey: string;
  storagePath: string;
  sha256: string;
  bytes: number;
  status: "stored" | "already_stored";
};

export async function storeFieldMediaOnDisk(input: {
  operationId: string;
  batchId: string;
  mediaId: string;
  sha256: string;
  body: ArrayBuffer;
  extension: "jpg" | "png" | "webp";
}): Promise<StoredFieldMedia> {
  const root = resolveFieldMediaRoot();
  const relative = join(
    /* turbopackIgnore: true */ input.operationId,
    input.batchId,
    `${input.mediaId}-${input.sha256.toLowerCase()}.${input.extension}`,
  );
  const objectKey = relative.split(sep).join("/");
  const finalPath = ensureWithinRoot(root, relative);
  const tempPath = `${finalPath}.${randomBytes(6).toString("hex")}.tmp`;

  if (existsSync(/* turbopackIgnore: true */ finalPath)) {
    return {
      objectKey,
      storagePath: finalPath,
      sha256: input.sha256.toLowerCase(),
      bytes: input.body.byteLength,
      status: "already_stored",
    };
  }

  await mkdir(dirname(finalPath), { recursive: true });
  try {
    await writeFile(/* turbopackIgnore: true */ tempPath, Buffer.from(input.body));
    await rename(/* turbopackIgnore: true */ tempPath, /* turbopackIgnore: true */ finalPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return {
    objectKey,
    storagePath: finalPath,
    sha256: input.sha256.toLowerCase(),
    bytes: input.body.byteLength,
    status: "stored",
  };
}

export async function readFieldMediaFromDisk(storagePath: string): Promise<Buffer> {
  const root = resolveFieldMediaRoot();
  const safePath = ensureAbsoluteWithinRoot(root, storagePath);
  return readFile(/* turbopackIgnore: true */ safePath);
}

export async function isFieldMediaDirWritable(): Promise<boolean> {
  try {
    const root = resolveFieldMediaRoot();
    await mkdir(root, { recursive: true });
    const probePath = join(root, `.probe-${Date.now()}-${randomBytes(4).toString("hex")}`);
    await writeFile(/* turbopackIgnore: true */ probePath, "ok");
    await unlinkSafe(probePath);
    return true;
  } catch {
    return false;
  }
}

async function unlinkSafe(path: string): Promise<void> {
  await unlink(/* turbopackIgnore: true */ path).catch(() => undefined);
}

export async function pingFieldStorage(): Promise<{ storage: boolean; media: boolean }> {
  const storage = await withFieldStorageClient(async (client) => {
    const result = await client.query<{ ok: number }>("select 1 as ok");
    return result.rows[0]?.ok === 1;
  }).catch(() => false);
  const media = await isFieldMediaDirWritable();
  return { storage, media };
}

export function closeFieldStorage(): Promise<void> {
  if (!cachedPool) {
    return Promise.resolve();
  }
  return cachedPool.end().catch(() => undefined).finally(() => {
    cachedPool = null;
    cachedConfig = null;
  });
}
