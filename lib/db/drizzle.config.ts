import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Relative so `drizzle-kit generate` resolves the migrations/meta dir correctly
  // (it prepends "./" to `out`, which corrupts an absolute path). pnpm --filter always
  // runs with cwd set to this package, so the relative path is stable.
  out: "drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
