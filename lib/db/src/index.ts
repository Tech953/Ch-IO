import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";
import { seedAll } from "./seed";

export * from "./schema";

/**
 * The application database handle type. Both the default `node-postgres` driver
 * and the embedded `pglite` driver expose the same Drizzle query-builder surface,
 * so the rest of the codebase can stay driver-agnostic and keep this single type.
 */
export type AppDatabase = NodePgDatabase<typeof schema>;

const driver = (process.env.ENGRAM_DB_DRIVER ?? "node-postgres").toLowerCase();

let dbInstance: AppDatabase;
let poolInstance: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;

if (driver === "pglite") {
  // Embedded, single-file Postgres (WASM). Used by the desktop build so the app
  // runs with no installed database. `PGLITE_DATA_DIR` persists to disk; when
  // unset PGlite runs in-memory (handy for tests).
  pgliteInstance = new PGlite(process.env.PGLITE_DATA_DIR);
  dbInstance = drizzlePglite(pgliteInstance, {
    schema,
  }) as unknown as AppDatabase;
} else if (
  driver === "node-postgres" ||
  driver === "pg" ||
  driver === "postgres"
) {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  const { Pool } = pg;
  poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  dbInstance = drizzleNodePg(poolInstance, { schema });
} else {
  throw new Error(
    `Unknown ENGRAM_DB_DRIVER "${driver}". Expected "node-postgres" or "pglite".`,
  );
}

export const db = dbInstance;
/** The pg connection pool — only present for the `node-postgres` driver. */
export const pool = poolInstance;
/** The embedded PGlite handle — only present for the `pglite` driver. */
export const pglite = pgliteInstance;

/** Close whichever underlying database handle is active. Safe to call once on shutdown. */
export async function closeDb(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
  }
}

export interface EnsureDatabaseReadyOptions {
  /**
   * Folder containing the generated Drizzle SQL migrations. Defaults to
   * `DRIZZLE_MIGRATIONS_DIR`, then a path relative to this module. The packaged
   * desktop app must pass this (or set the env var) because the bundle is run
   * outside the source tree.
   */
  migrationsFolder?: string;
  /** Run the idempotent reference/data seeds after migrating. Defaults to true. */
  seed?: boolean;
}

function defaultMigrationsFolder(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../drizzle",
  );
}

/**
 * Bring an embedded (pglite) database up to date: run migrations, then seed.
 *
 * This is a NO-OP for the `node-postgres` driver — Replit/dev manage schema via
 * `drizzle-kit push` and the existing seed scripts, so this never touches that
 * path. The desktop bootstrap calls this before starting the server.
 */
export async function ensureDatabaseReady(
  opts: EnsureDatabaseReadyOptions = {},
): Promise<void> {
  if (driver !== "pglite" || !pgliteInstance) {
    return;
  }
  const migrationsFolder =
    opts.migrationsFolder ??
    process.env.DRIZZLE_MIGRATIONS_DIR ??
    defaultMigrationsFolder();
  await migratePglite(dbInstance as never, { migrationsFolder });
  if (opts.seed ?? true) {
    await seedAll(dbInstance);
  }
}
