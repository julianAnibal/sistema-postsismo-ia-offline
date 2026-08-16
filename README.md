# 1000 Ojos

Monorepo reproducible para documentar evidencia postsismo con funcionamiento
offline. Incluye la aplicación Expo para Android y PWA, Gemma 4 E2B con
LiteRT-LM, proxy nativo de calidad de captura, sincronización autenticada,
backend Railway/PostgreSQL y consola privada de revisión.

Los resultados son apoyo documental: no son diagnóstico estructural,
habitabilidad ni triaje oficial.

## Estructura

- `apps/mobile`: Expo Android/PWA, almacenamiento e integridad de evidencia,
  cola offline, sincronización y módulos Kotlin.
- `apps/backend`: APIs Next.js para lotes y medios, autenticación, CORS,
  idempotencia, validación SHA-256, PostgreSQL y consola `/field-review`.
- `packages/contracts`: contrato Zod versionado para lotes de sincronización.
- `ml`: preparación, evaluación y empaquetado reproducible de modelos.
- `docs`: límites, runbooks y evidencia de validación.

## Instalación y reproducción local

Requiere Node 20+, npm, Python 3.11+ y PostgreSQL.

```bash
cp .env.example .env
npm run install:all
docker compose up -d postgres
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/1000_ojos
export FIELD_MEDIA_DIR="$(pwd)/.field-media"
export INTERNAL_API_ENABLED=true
export INTERNAL_API_TOKEN=replace-with-at-least-32-random-bytes
npm run migrate
npm run dev:backend
```

En otra terminal:

```bash
export EXPO_PUBLIC_FIELD_API_URL=http://localhost:3000
cd apps/mobile
npm run web
```

Configure el mismo token en la pantalla de sincronización. La consola privada
está en `http://localhost:3000/field-review`.

## Builds

```bash
npm run build:web
npm run build:backend
cd apps/mobile && npx expo run:android
```

Vercel usa `apps/mobile/vercel.json` con root directory `apps/mobile`.
Railway usa `apps/backend/railway.json` con root directory `apps/backend`,
PostgreSQL adjunto y un volumen persistente. Consulte
`apps/backend/docs/1000_OJOS_PRODUCTION.md`.

## Modelos Gemma

Los modelos multi-GB no se versionan. La aplicación conserva URLs, revisiones,
tamaños y SHA-256 exactos y no usa un modelo hasta verificar sus bytes. Los
WASM necesarios para el runtime web sí están versionados.

- Web: `gemma-4-E2B-it-web.litertlm`, 2,008,432,640 bytes,
  SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`.
- Android: `gemma-4-E2B-it-int4.litertlm`, 2,588,147,712 bytes,
  SHA-256 `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`.

La evidencia y las limitaciones vigentes están en
`docs/CROSS-TASK-HANDOFF.md`.
