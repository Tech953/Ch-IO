#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ENGRAM / PYRI — one-time local setup (Linux / macOS)
#
# Checks prerequisites, creates .env, installs dependencies, pushes the
# database schema, and seeds reference data. Run this once, then use
# ./scripts/local/start.sh to launch the app.
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

echo "==> ENGRAM local setup"
echo "==> Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js 24+ is required — https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm is required — install with: npm install -g pnpm"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 24 ] || echo "WARNING: Node $NODE_MAJOR detected; Node 24+ is recommended."
command -v ffmpeg >/dev/null 2>&1 || echo "NOTE: ffmpeg not found — video media perception is unavailable (text/image/audio are unaffected)."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example. Edit it to match your local Postgres + model."
fi

load_dotenv

echo "==> Installing dependencies (this needs internet the first time)..."
pnpm install

echo "==> Pushing database schema to the local database..."
pnpm --filter @workspace/db run push

echo "==> Seeding reference data (idempotent)..."
pnpm --filter @workspace/scripts run seed:expressions
pnpm --filter @workspace/scripts run seed:engrams
pnpm --filter @workspace/scripts run seed:hub

echo ""
echo "==> Setup complete. Start the app with:  ./scripts/local/start.sh"
