#!/bin/zsh
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/rustup/bin:$PATH"

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  print -u2 "Falta LINEAR_API_KEY. Exporte una key personal de Linear en esta terminal."
  exit 2
fi

if ! command -v codex >/dev/null 2>&1; then
  print -u2 "No se encontró Codex CLI en PATH."
  exit 3
fi

export OPENSYMPHONY_HARNESS="${OPENSYMPHONY_HARNESS:-codex_app_server}"
export OPENSYMPHONY_MODEL="${OPENSYMPHONY_MODEL:-gpt-5.5}"
export OPENSYMPHONY_MODEL_PROFILE="${OPENSYMPHONY_MODEL_PROFILE:-codex-chatgpt-local-keychain}"
export OPENSYMPHONY_CODEX_BIN="${OPENSYMPHONY_CODEX_BIN:-$(command -v codex)}"

exec opensymphony run
