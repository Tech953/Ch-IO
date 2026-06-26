---
name: Desktop embedded DB seam (pglite)
description: How the ENGRAM/PYRI app runs with an embedded database for the desktop build, and the non-obvious bundling constraints.
---

# Desktop embedded DB seam

`lib/db/src/index.ts` selects a Drizzle driver from `ENGRAM_DB_DRIVER`:
- default / unset / `node-postgres` → pg `Pool` from `DATABASE_URL` (Replit, dev, seed CLIs). Unchanged.
- `pglite` → embedded `@electric-sql/pglite` (WASM Postgres). `PGLITE_DATA_DIR` persists to disk; unset = in-memory (tests).

`ensureDatabaseReady({ migrationsFolder, seed })` runs the pglite migrator + `seedAll`. It is a **NO-OP on the pg path**, so it is safe to call unconditionally — the api-server boot (`artifacts/api-server/src/index.ts`) awaits it before `listen`. Seeds live in `lib/db/src/seed/*` as importable idempotent functions (`onConflictDoNothing`); the `scripts/src/seed-*.ts` CLIs are thin wrappers over them.

**Why the desktop bootstrap must run inside the api-server bundle, not Electron main:** the pglite instance is a singleton in `lib/db`. If Electron main imported lib/db AND the server bundle did, you'd get two PGlite instances on the same data dir. So migrate+seed happen inside the server process (the bundle), and Electron main only sets env + spawns it.

## Non-obvious bundling constraints

- **`@electric-sql/pglite` must be a DIRECT dependency of `@workspace/api-server`**, not just `@workspace/db`. The api-server esbuild bundle externalizes it (added to `build.mjs` `external`), and it is *statically* imported by `lib/db` — so the import must resolve at runtime even on the pg path. Under pnpm's strict node_modules, a transitive-only dep is NOT resolvable from the bundle's own dir (`artifacts/api-server/dist/index.mjs`) → `ERR_MODULE_NOT_FOUND`. Declaring it directly puts it in `artifacts/api-server/node_modules`.
- pglite 0.5.x has **zero runtime deps** and ships `pglite.wasm` (~10MB), `pglite.data` (~6MB), `initdb.wasm` inside its own `dist/`. For the packaged desktop app, copy just that one package folder next to the externalized bundle (e.g. `resources/server/node_modules/@electric-sql/pglite`) so ESM resolution + the wasm/data files are both satisfied.
- In the bundle, `import.meta.url` points at `dist/`, so the migrations folder cannot be found relative to it. The desktop bootstrap **must** pass `DRIZZLE_MIGRATIONS_DIR` (or `migrationsFolder`) explicitly to `ensureDatabaseReady`.

**How to apply:** any new runtime dep that the api-server bundle externalizes (native or wasm-bearing) must be a direct dep of api-server and, for desktop, shipped as an unpacked package folder next to the bundle.
