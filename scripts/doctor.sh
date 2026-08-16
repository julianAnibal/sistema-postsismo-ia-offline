#!/bin/zsh
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/rustup/bin:$PATH"
export OPENSYMPHONY_HARNESS="${OPENSYMPHONY_HARNESS:-codex_app_server}"
export OPENSYMPHONY_MODEL="${OPENSYMPHONY_MODEL:-gpt-5.5}"
export OPENSYMPHONY_MODEL_PROFILE="${OPENSYMPHONY_MODEL_PROFILE:-codex-chatgpt-local-keychain}"
export OPENSYMPHONY_CODEX_BIN="${OPENSYMPHONY_CODEX_BIN:-$(command -v codex || true)}"

opensymphony doctor
