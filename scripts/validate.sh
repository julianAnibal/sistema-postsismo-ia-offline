#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
cd "$root"

for required in README.md AGENTS.md WORKFLOW.md config.yaml docs/product-brief.md docs/task-graph.md docs/team-workflow.md docs/runbook.md .github/workflows/validate.yml; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo requerido: $required"; exit 1; }
done

rg -q 'project_slug: "sistema-postsismo-ia-offline-d12fe65705e4"' WORKFLOW.md
rg -q 'harness: codex_app_server' WORKFLOW.md
rg -q 'github.com/julianAnibal/sistema-postsismo-ia-offline.git' WORKFLOW.md
rg -q 'OPENSYMPHONY_HARNESS=.*codex_app_server' scripts/run.sh
rg -q '^\.env$' .gitignore
rg -q 'work/DNA-XX' docs/team-workflow.md
rg -q 'Issue: DNA-XX' .github/pull_request_template.md

for required in apps/mobile/package.json apps/mobile/app.json apps/mobile/src/domain/types.ts apps/mobile/src/storage/useFieldStore.ts; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo móvil requerido: $required"; exit 1; }
done

for required in pyproject.toml uv.lock ml/README.md ml/scripts/pipeline.py ml/jobs/train_sft_lora.py ml/jobs/train_vision_segmentation.py docs/training-runbook.md; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo de entrenamiento requerido: $required"; exit 1; }
done

if rg -n '/Users/[^/]+/' --glob '!docs/proof-of-life.md' --glob '!scripts/validate.sh' .; then
  print -u2 "Se encontro una ruta personal fuera del informe historico."
  exit 1
fi

if rg -n '(lin_api_[A-Za-z0-9]+|sk-[A-Za-z0-9]{12,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' --glob '!*.example' .; then
  print -u2 "Se encontró un posible secreto."
  exit 1
fi

git diff --check
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile test
npm --prefix apps/mobile run export:web
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$root/.venv-validation}"
uv sync --frozen --no-progress
validation_python="$UV_PROJECT_ENVIRONMENT/bin/python"
[[ -x "$validation_python" ]] || {
  print -u2 "No se creo el interprete bloqueado: $validation_python"
  exit 1
}
"$validation_python" -m unittest discover -s ml/tests -v
"$validation_python" ml/scripts/pipeline.py demo
print "Validación del harness: OK"
