#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
cd "$root"

for required in README.md AGENTS.md WORKFLOW.md config.yaml docs/product-brief.md docs/task-graph.md docs/runbook.md; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo requerido: $required"; exit 1; }
done

rg -q 'project_slug: "sistema-postsismo-ia-offline-d12fe65705e4"' WORKFLOW.md
rg -q 'harness: codex_app_server' WORKFLOW.md
rg -q 'OPENSYMPHONY_HARNESS=.*codex_app_server' scripts/run.sh
rg -q '^\.env$' .gitignore

if rg -n '(lin_api_[A-Za-z0-9]+|sk-[A-Za-z0-9]{12,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' --glob '!*.example' .; then
  print -u2 "Se encontró un posible secreto."
  exit 1
fi

git diff --check
print "Validación del harness: OK"
