---
name: Database seeding
description: How reference/lookup data gets into the DB in this repo (no auto-seed exists).
---

# Database seeding

There is **no** startup seeding and no auto-seed on `db push`. Pushing schema to a fresh
database creates **empty** tables. Existing reference rows (hiero symbols, beliefs,
personas) were inserted out-of-band in earlier sessions.

**Rule:** when you add a DB-backed reference/lookup table, also add a reproducible,
idempotent seed script so a fresh environment is not left empty.

**How to apply:**
- Put the seed in `@workspace/scripts` (`scripts/src/<name>.ts`), import `db`/`pool` +
  the table from `@workspace/db`, insert with drizzle `.onConflictDoNothing({ target: <uniqueCol> })`,
  and `await pool.end()` at the end so the process exits.
- Register it as a `scripts` npm script (e.g. `seed:expressions`) and run via
  `pnpm --filter @workspace/scripts run <name>`.
- `scripts` must declare `@workspace/db` as a dependency (`workspace:*`).

**Why:** the architect flagged that a `db push` on a fresh env would silently produce an
empty library because seeding had only ever been done manually via raw SQL.
