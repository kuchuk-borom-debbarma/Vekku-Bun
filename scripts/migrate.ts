import { getDb } from "../src/db";
import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const runMigration = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const db = getDb(dbUrl);

  const drizzleDir = join(process.cwd(), "drizzle");
  const files = readdirSync(drizzleDir).filter(f => f.endsWith(".sql"));
  
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const migrationFile = join(drizzleDir, files[0]!); // Take the first one
  
  console.log(`Applying ${migrationFile}...`);
  const sqlContent = readFileSync(migrationFile, "utf-8");

  const statements = sqlContent.split("--> statement-breakpoint");

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.execute(sql.raw(statement));
      } catch (e: any) {
        const errorString = e.toString() + (e.message || "") + (e.cause ? JSON.stringify(e.cause) : "");
        if (!errorString.includes("already exists")) {
            console.error("Error executing statement:", statement);
            console.error(e);
            throw e;
        }
        console.log("Skipping existing relation...");
      }
    }
  }
  console.log("Migrations applied successfully.");
};

runMigration();
