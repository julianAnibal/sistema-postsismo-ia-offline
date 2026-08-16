#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
cd "$root"

for required in README.md AGENTS.md WORKFLOW.md config.yaml docs/product-brief.md docs/task-graph.md docs/team-workflow.md docs/mobile-field-architecture.md docs/mobile-ux-requirements.md docs/decisions/DNA-81-mobile-runtime-local-ai.md docs/runbook.md .github/workflows/validate.yml; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo requerido: $required"; exit 1; }
done

rg -q 'project_slug: "sistema-postsismo-ia-offline-d12fe65705e4"' WORKFLOW.md
rg -q 'harness: codex_app_server' WORKFLOW.md
rg -q 'github.com/julianAnibal/sistema-postsismo-ia-offline.git' WORKFLOW.md
rg -q 'OPENSYMPHONY_HARNESS=.*codex_app_server' scripts/run.sh
rg -q '^\.env$' .gitignore
rg -q 'work/DNA-XX' docs/team-workflow.md
rg -q 'Issue: DNA-XX' .github/pull_request_template.md
rg -q 'Estado: `Proposed`' docs/decisions/DNA-81-mobile-runtime-local-ai.md
rg -q 'Sin servidor local escuchando en LAN por defecto' docs/mobile-field-architecture.md

if rg -n '/Users/[^/]+/' --glob '!docs/proof-of-life.md' --glob '!scripts/validate.sh' .; then
  print -u2 "Se encontro una ruta personal fuera del informe historico."
  exit 1
fi

if rg -n '(lin_api_[A-Za-z0-9]+|sk-[A-Za-z0-9]{12,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' --glob '!*.example' .; then
  print -u2 "Se encontró un posible secreto."
  exit 1
fi

git diff --check
print "Validación del harness: OK"
