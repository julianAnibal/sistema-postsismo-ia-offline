#!/bin/zsh
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/opt/rustup/bin:$PATH"
exec opensymphony tui
