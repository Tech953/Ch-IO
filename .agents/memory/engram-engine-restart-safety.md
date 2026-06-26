---
name: Engram engine restart safety
description: Why every autonomy guard in the engram engine must be DB-backed, not in-memory.
---

# Engram engine restart safety

The autonomous engine ticks in-process. Any state it keeps only in memory is lost when the API server restarts/redeploys, which lets a restart loop bypass that guard.

**Rule:** every cadence/cost/pressure guard the engine relies on must be persisted on the engram row and re-read each tick — never a module-level `Map`/variable.

**Why:** per-drive pressure, `lastTickAt`, `lastTransmissionAt`, and the error-backoff window all gate generation (which costs LLM calls). If any resets to zero on restart, an engram either forgets its accrued pressure or a crash-restart loop hammers the model. Cooldown + hourly/daily caps are already restart-safe because they're derived from the transmissions table; pressure (`driveState`) and the backoff window are restart-safe because they live in columns on `engrams`.

**How to apply:** when adding a new engine guard, store it on the engram row (or a related table) and read it from the freshly-selected row in `runTick`. A successful emit should clear transient guards (e.g. it nulls `backoffUntil`); a failure should persist them alongside the accrued `driveState`.
