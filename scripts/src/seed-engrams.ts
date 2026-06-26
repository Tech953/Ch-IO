import { db, closeDb } from "@workspace/db";
import { seedEngrams } from "@workspace/db/seed";

async function main() {
  const { inserted, total } = await seedEngrams(db);
  console.log(
    `Seeded engrams: ${inserted} inserted, ${total - inserted} already present.`,
  );
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
