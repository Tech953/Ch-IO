import { db, closeDb } from "@workspace/db";
import { seedHub } from "@workspace/db/seed";

async function main() {
  const { spacesInserted, spacesTotal, placed } = await seedHub(db);
  console.log(
    `Seeded hub: ${spacesInserted} spaces inserted, ${spacesTotal - spacesInserted} already present; ${placed} engrams placed in The Commons.`,
  );
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
