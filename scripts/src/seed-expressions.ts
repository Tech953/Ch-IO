import { db, closeDb } from "@workspace/db";
import { seedExpressions } from "@workspace/db/seed";

async function main() {
  const { inserted, total } = await seedExpressions(db);
  console.log(
    `Seeded expressions: ${inserted} inserted, ${total - inserted} already present.`,
  );
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
