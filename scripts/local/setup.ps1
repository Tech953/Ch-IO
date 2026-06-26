#Requires -Version 5
# ---------------------------------------------------------------------------
# ENGRAM / PYRI - one-time local setup (Windows / PowerShell)
#
# Checks prerequisites, creates .env, installs dependencies, pushes the
# database schema, and seeds reference data. Run this once, then use
# .\scripts\local\start.ps1 to launch the app.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
Set-Location $RootDir

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  foreach ($raw in Get-Content $Path) {
    $line = $raw.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $val
  }
}

Write-Host "==> ENGRAM local setup"
Write-Host "==> Checking prerequisites..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Error "Node.js 24+ is required - https://nodejs.org"; exit 1 }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Write-Error "pnpm is required - install with: npm install -g pnpm"; exit 1 }
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 24) { Write-Host "WARNING: Node $nodeMajor detected; Node 24+ is recommended." }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host "NOTE: ffmpeg not found - video media perception is unavailable (text/image/audio are unaffected)." }

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "==> Created .env from .env.example. Edit it to match your local Postgres + model."
}

Import-DotEnv ".env"

Write-Host "==> Installing dependencies (this needs internet the first time)..."
pnpm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Pushing database schema to the local database..."
pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Seeding reference data (idempotent)..."
pnpm --filter @workspace/scripts run seed:expressions
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter @workspace/scripts run seed:engrams
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter @workspace/scripts run seed:hub
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> Setup complete. Start the app with:  .\scripts\local\start.ps1"
