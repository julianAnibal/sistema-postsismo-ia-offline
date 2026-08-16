#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
cd "$root"

for required in \
  README.md package.json package-lock.json compose.yaml railway.json \
  apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/vercel.json \
  apps/backend/package.json \
  packages/contracts/package.json packages/contracts/src/index.ts \
  pyproject.toml uv.lock ml/README.md docs/CROSS-TASK-HANDOFF.md; do
  [[ -s "$required" ]] || { print -u2 "Falta archivo requerido: $required"; exit 1; }
done

if rg -n '/Users/[^/]+/' --glob '!docs/proof-of-life.md' --glob '!scripts/validate.sh' .; then
  print -u2 "Se encontró una ruta personal fuera del informe histórico."
  exit 1
fi

if rg -n '(lin_api_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]{12,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' --glob '!*.example' .; then
  print -u2 "Se encontró un posible secreto."
  exit 1
fi

git diff --check
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test:unit
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile test
npm --prefix apps/mobile run export:web

export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$root/.venv-validation}"
uv sync --frozen --no-progress
validation_python="$UV_PROJECT_ENVIRONMENT/bin/python"
[[ -x "$validation_python" ]] || {
  print -u2 "No se creó el intérprete bloqueado: $validation_python"
  exit 1
}
"$validation_python" -m unittest discover -s ml/tests -v
"$validation_python" ml/scripts/pipeline.py demo
print "Validación del monorepo: OK"
