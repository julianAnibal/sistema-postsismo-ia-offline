-- 1000 ojos field-intake schema. Compatible with vanilla PostgreSQL (Railway
-- Postgres) and Supabase Postgres. No Supabase-only extensions such as
-- storage.buckets are required; photo bytes live on a mounted Railway volume
-- and are addressed by SHA-256.

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

-- Row-level security is set up only on Supabase Postgres deployments; the
-- Node migration script enables it when the running role has the privilege.
-- Service-role and server-side migrations always bypass RLS.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    execute 'alter table field_sync_batches enable row level security';
    execute 'alter table field_devices enable row level security';
    execute 'alter table field_audit_log enable row level security';
    execute 'alter table field_reviews enable row level security';
    execute 'alter table field_media enable row level security';
  end if;
end
$$ language plpgsql;
