# 1000 ojos production activation on Railway

Configure the Railway service with the repository root as its root directory.
The root `railway.json` installs the monorepo workspace, builds
`apps/backend`, and keeps `packages/contracts` available to the backend.

The code is deployable without enabling private field intake. Activation requires operator-owned accounts and secrets that are intentionally absent from Git.

1. Provision a Railway project with:
   - One Railway service using the root `railway.json`. Keep it at one replica because a Railway volume cannot be shared safely by multiple application replicas.
   - A Railway Postgres database attached to the service. Copy its connection string into `DATABASE_URL`.
   - A private Railway volume mounted into the service. The service exposes `RAILWAY_VOLUME_MOUNT_PATH`. Field bytes live at `${RAILWAY_VOLUME_MOUNT_PATH}/field-media/`. Set `FIELD_MEDIA_DIR` instead for local or non-Railway deployments.
   - The externally hosted Vercel PWA origin(s) listed in `FIELD_ALLOWED_ORIGINS` (comma-separated, exact origins). Native callers without an `Origin` header are always allowed.
2. Apply the schema. `npm run start:railway` runs this idempotent command automatically before every server start; it can also be checked manually from the project root:

   ```bash
   npm ci
   npm run migrate:field
   ```

   The migration tracks applied IDs in `field_storage_migrations` and is safe to re-run.
3. Generate a random internal API token of at least 32 bytes and set `INTERNAL_API_TOKEN`. Set `INTERNAL_API_ENABLED=true` only after the migration succeeds and the `/api/health` endpoint reports `ok`.
4. Configure the Railway health check against `/api/health` (public, unauthenticated, returns 200 when Postgres and the media directory are usable).
5. Open `/field-review`, enter the same operational token, and confirm that no field data is returned without authentication. Open a recent expediente, verify that every uploaded photograph renders from the private media endpoint, and save a human decision with notes.
6. Enroll each phone through its synchronization screen. To revoke a phone, set `field_devices.status='revoked'` and `revoked_at=now()` for its SHA-256 installation identifier; the next `/field-sync` call from that device returns `403 internal_api_unauthorized`.

The `DATABASE_URL` secret belongs only to the Railway service. The phone stores its operational token in Keychain/Keystore and only transmits it over HTTPS. Web preview sessions keep the token in session storage, not persistent browser storage.

Photo objects are private, limited to 15 MB, restricted to JPEG/PNG/WebP, addressed by SHA-256, written atomically to the mounted volume, and verified against metadata in an already accepted batch before storage. Authenticated reads recheck path containment, byte count, and SHA-256 and are never cached. Field batches, photos, and reviews have no unauthenticated endpoint. Publishing an approved, allowlisted aggregate remains a separate human action.

If the deployment target is Supabase Postgres instead of Railway Postgres, the same migration file works against either database. The only Supabase-specific branch is the optional row-level-security block at the end of `supabase/migrations/0002_field_sync_batches.sql`, which runs only when the `supabase_admin` role exists.
