# Agent Instructions

## Project

This repository is the execution harness and initial implementation workspace
for a Colombian post-earthquake field system. It coordinates decisions and code
through OpenSymphony and Linear project `Sistema Postsismo IA Offline`.

The target product combines:

- a React Native field application;
- SQLite and reliable offline synchronization;
- on-device assistive computer vision through ONNX Runtime Mobile;
- MapLibre Native and authorized offline map packages;
- a private API, PostgreSQL/PostGIS and private object storage;
- a Next.js/OpenLayers review and publication surface;
- versioned Colombian inspection reports with an ATC-20 semantic crosswalk.

## Product boundary

The product is a capture, assistance, review and consolidation system. It is not
an autonomous structural diagnosis, official EDAN/RUD replacement, rescue
system, or source of authority.

## Repository structure

```text
.
├── .agents/                 # OpenSymphony agent skills
├── .opensymphony/memory/    # project memory configuration
├── docs/
│   ├── decisions/           # ADRs proposed by Decision tickets
│   ├── product-brief.md      # architecture and safety summary
│   ├── runbook.md            # operator procedures
│   └── task-graph.md         # milestones and dependency map
├── scripts/                 # safe local launch and validation wrappers
├── AGENTS.md
├── WORKFLOW.md
└── config.yaml
```

Application packages will be added only by approved implementation tickets.

## Engineering rules

- Prefer TypeScript for shared contracts and application code.
- Validate external and synchronized data at boundaries.
- Use migrations for persisted schemas.
- Make signed inspections append-only; corrections create successor versions.
- Make server writes idempotent and media immutable by SHA-256.
- Keep public export allowlisted by field.
- Use synthetic test fixtures with impossible names and coordinates.
- Add comments only where behavior is not self-evident.
- Keep changes scoped to the current Linear issue.

## Safety and privacy

- AI outputs are suggestions with model ID, hash, thresholds and confidence.
- A human observation never becomes an authority approval implicitly.
- No facial recognition, sensitive-trait inference or public household records.
- Store capture point, accuracy and building geometry separately.
- Do not interpret missing imagery or inaccessible areas as no damage.
- Never put secrets or real event PII in Git, logs or fixtures.

## Validation

Until application packages exist, the baseline checks are:

```bash
./scripts/validate.sh
git diff --check
```

As packages are added, each implementation ticket must add its formatter, lint,
type-check and test commands to `scripts/validate.sh`.

## Decisions

Approved decisions live in `docs/decisions/`. Agents can author Proposed ADRs;
only human review can change them to Accepted.

## Sources

- OpenSymphony: https://opensymphony.dev/
- IDIGER inspection guide and forms: https://www.idiger.gov.co/
- ATC-20: https://www.atcouncil.org/atc-20
- Ultralytics Crack-Seg: https://docs.ultralytics.com/datasets/segment/crack-seg/
- ODK: https://docs.getodk.org/
- MapLibre: https://maplibre.org/
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- ONNX Runtime Mobile: https://onnxruntime.ai/docs/tutorials/mobile/
