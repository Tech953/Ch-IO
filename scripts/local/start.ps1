#Requires -Version 5
# ---------------------------------------------------------------------------
# ENGRAM / PYRI - start fully locally on a single port (Windows / PowerShell)
#
# Builds the dashboard and the API, then runs one server that serves BOTH the
# dashboard and /api on http://localhost:$PORT. On first run it automatically
# performs one-time setup (deps + database + seeds).
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

if (-not (Test-Path "node_modules") -or -not (Test-Path ".env")) {
  Write-Host "==> First run detected - running one-time setup..."
  & (Join-Path $ScriptDir "setup.ps1")
}

Import-DotEnv ".env"

if (-not $env:PORT) { $env:PORT = "5000" }
$env:BASE_PATH = "/"
$env:WEB_DIST = (Join-Path $RootDir "artifacts\engram\dist\public")

Write-Host "==> Building dashboard (frontend)..."
pnpm --filter @workspace/engram run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Building API server..."
pnpm --filter @workspace/api-server run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "============================================================"
Write-Host "  ENGRAM is running at:  http://localhost:$($env:PORT)"
Write-Host "  API health check:      http://localhost:$($env:PORT)/api/healthz"
Write-Host "  Press Ctrl+C to stop."
Write-Host "============================================================"
Write-Host ""
node --enable-source-maps artifacts/api-server/dist/index.mjs
