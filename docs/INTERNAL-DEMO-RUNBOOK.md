# 1000 Ojos internal demo

## Ready surfaces

- Field PWA: <https://1000-ojos-postsismo.vercel.app>
- Private review console: <https://backend-production-0d88.up.railway.app/field-review>
- Backend health: <https://backend-production-0d88.up.railway.app/api/health>

Use the operational token from the Railway `backend` service. Never paste it into slides, chat, source control, screenshots, or a public URL.

## Recommended 6-minute sequence

1. Open the PWA and state that the installed data is synthetic.
2. Open **Centro comunitario Amapola** and show the structured observation fields, evidence capture controls, offline draft, deterministic library assistant, and optional Gemma controls.
3. Open **Sincronizar**, confirm the Railway endpoint, enter the operational token, and synchronize a reviewed draft.
4. Open the private review console, enter the same token, and select **Actualizar**.
5. Show the synthetic `Edificio Sintético Aurora` record, its evidence count, and the human-review decision.
6. Close with the integrity and resilience proof: stable retry IDs, duplicate/conflict rejection, byte-level SHA-256 verification, PostgreSQL persistence, and media persistence across a backend restart.

## Presenter guardrails

- Say “observación de campo para revisión”, not “diagnóstico”.
- Say “daño observado”, not “edificio inhabitable”.
- Say “decisión humana obligatoria”, not “triaje oficial automatizado”.
- Do not claim iOS validation or a minimum physical-phone memory requirement.
- Do not download the multi-gigabyte Gemma model during the presentation. Pre-provision it on the presentation browser or use the checked-in offline proof and demonstrate the deterministic assistant live.

## Preflight, 15 minutes before

1. Load all three URLs above and verify health reports `storage: ok` and `media: ok`.
2. Confirm the presentation browser already has Gemma provisioned if live generative inference is part of the script.
3. Keep the review-console token field masked and the console tab open.
4. Keep `docs/evidence/gemma-e2b-offline-proof.png` and `docs/evidence/internal-demo-review-console.png` open as fallbacks.
5. Use synthetic records only and avoid real personal or location data.

The machine-readable production check is in `docs/evidence/internal-demo-production-e2e-v1.json`.
