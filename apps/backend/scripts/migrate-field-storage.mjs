#!/usr/bin/env node
// Idempotent PostgreSQL migration for the 1000 ojos field-intake tables.
// This mirrors the SQL registered with runFieldStorageMigrations() in
// src/lib/data/field-storage.ts and stays compatible with Railway Postgres
// without Supabase-specific extensions such as storage.buckets.

import pg from "pg";

const MIGRATION_TABLE = "field_storage_migrations";

const MIGRATIONS = [
  {
    id: "0002_field_sync_batches",
    description: "Create field sync batch, device, audit, review, and media tables.",
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

function parseArgs(argv) {
  const parsed = { _: [], databaseUrl: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));
const databaseUrl = args.databaseUrl ?? args["database-url"] ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Pass --database-url or set the env variable.");
  process.exit(2);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  application_name: "1000-ojos-field-migration",
  statement_timeout: 60_000,
});

let appliedCount = 0;
let alreadyAppliedCount = 0;

try {
  await client.connect();
  await client.query(`
    create table if not exists ${MIGRATION_TABLE} (
      id text primary key,
      description text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of MIGRATIONS) {
    const existing = await client.query(
      `select id from ${MIGRATION_TABLE} where id = $1`,
      [migration.id],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`skip - ${migration.id} (already applied)`);
      alreadyAppliedCount += 1;
      continue;
    }
    await client.query("begin");
    try {
      await client.query(migration.sql);
      await client.query(
        `insert into ${MIGRATION_TABLE} (id, description) values ($1, $2)`,
        [migration.id, migration.description],
      );
      await client.query("commit");
      console.log(`apply - ${migration.id}`);
      appliedCount += 1;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  }

  console.log(`migrate:field complete (applied=${appliedCount}, already=${alreadyAppliedCount})`);
} catch (error) {
  console.error("migrate:field failed");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
