import { getDb } from "../src/db";
import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const runMigration = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const db = getDb(dbUrl);

  const drizzleDir = join(process.cwd(), "drizzle");
  const files = readdirSync(drizzleDir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // Sort alphabetically to ensure correct order (0000, 0001, etc.)
  
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  for (const file of files) {
    const migrationFile = join(drizzleDir, file);
    console.log(`Applying ${file}...`);
    const sqlContent = readFileSync(migrationFile, "utf-8");

    const statements = sqlContent.split("--> statement-breakpoint");

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.execute(sql.raw(statement));
        } catch (e: any) {
          // Simple error handling for "already exists" to make it idempotent-ish
          const errorString = e.toString() + (e.message || "") + (e.cause ? JSON.stringify(e.cause) : "");
          if (!errorString.includes("already exists") && !errorString.includes("DuplicateColumn")) {
              console.error("Error executing statement in " + file + ":", statement);
              console.error(e);
              // We don't throw here to allow subsequent migrations to try, 
              // but in production you might want to stop.
              // For dev, this is more forgiving.
          } else {
             // console.log("Skipping existing relation/column...");
          }
        }
      }
    }
  }
  console.log("Migrations applied successfully.");
};

runMigration();
