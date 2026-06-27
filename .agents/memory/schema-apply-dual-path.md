---
name: schema apply dual path (pg push + pglite migrate)
description: Why a schema change must be both pushed AND generated, and the drizzle-kit generate out-path bug.
---

# Schema changes need BOTH push and a generated migration

When you edit `lib/db/src/schema/*.ts`, run **both**:
- `pnpm --filter @workspace/db run push` — updates the dev/Replit Postgres DB in place.
- `pnpm --filter @workspace/db run generate` — emits an incremental migration into `lib/db/drizzle/` (e.g. `0001_*.sql` + `meta` snapshot + `_journal.json`).

**Why:** `ensureDatabaseReady()` is a **no-op on the node-postgres driver** — dev/Replit schema is push-managed and never runs `migrate()`. `migrate()` runs **only** on the pglite/desktop path. So if you only `push`, the dev DB is correct but fresh desktop/PGlite installs drift (their migrations don't have the new columns). A prior review caught exactly this: `media_assets` had been made nullable + gained columns via push, but the checked-in migration still had the old NOT NULL / missing columns.

**Gotcha — drizzle-kit generate corrupts an absolute `out`:** generate prepends `./` to `out`, so an absolute `out` (e.g. `path.join(__dirname, "./drizzle")`) resolves wrong and fails with ENOENT on the meta snapshot. `out` in `drizzle.config.ts` must be **relative** (`out: "drizzle"`) — `pnpm --filter` always runs with cwd at the package, so a relative path is stable. `push` is unaffected by this (it never reads the meta/snapshot files), which is why push works while generate breaks.

**How to apply:** after any schema edit, push for dev, generate for desktop, then verify a fresh migrate with an in-memory PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite/migrator` `migrate(db, { migrationsFolder })`) if the change is risky. Commit `0001_*.sql`, its `meta/0001_snapshot.json`, and the updated `_journal.json` together.
