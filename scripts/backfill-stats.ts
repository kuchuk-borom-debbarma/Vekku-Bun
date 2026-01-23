import { getDb } from "../src/db";
import { sql } from "drizzle-orm";

const backfill = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  const db = getDb(dbUrl);

  console.log("Backfilling user metadata counts...");

  try {
    await db.execute(sql`
      UPDATE users u
      SET metadata = jsonb_build_object(
        'contentCount', (SELECT count(*) FROM contents c WHERE c.fk_user_id = u.id),
        'tagCount', (SELECT count(*) FROM tags t WHERE t.fk_user_id = u.id)
      );
    `);
    console.log("Done.");
  } catch (e) {
    console.error("Backfill failed:", e);
  }
};

backfill();
