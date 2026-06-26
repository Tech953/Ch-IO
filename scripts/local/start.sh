#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ENGRAM / PYRI — start fully locally on a single port (Linux / macOS)
#
# Builds the dashboard and the API, then runs one server that serves BOTH the
# dashboard and /api on http://localhost:$PORT. On first run it automatically
# performs one-time setup (deps + database + seeds).
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# Load a simple KEY=value .env into the environment (no shell evaluation).
load_dotenv() {
  [ -f .env ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | \#*) continue ;; esac
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < .env
}

if [ ! -d node_modules ] || [ ! -f .env ]; then
  echo "==> First run detected — running one-time setup..."
  "$SCRIPT_DIR/setup.sh"
fi

load_dotenv

: "${PORT:=5000}"
export PORT
export BASE_PATH="/"
export WEB_DIST="$ROOT_DIR/artifacts/engram/dist/public"

echo "==> Building dashboard (frontend)..."
pnpm --filter @workspace/engram run build

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo ""
echo "============================================================"
echo "  ENGRAM is running at:  http://localhost:${PORT}"
echo "  API health check:      http://localhost:${PORT}/api/healthz"
echo "  Press Ctrl+C to stop."
echo "============================================================"
echo ""
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
