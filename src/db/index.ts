import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

export const getDb = (url?: string) => {
  if (dbInstance) return dbInstance;

  const connectionString = url || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Pass it to getDb() or set it in the environment.",
    );
  }

  const client = neon(connectionString);
  dbInstance = drizzle(client, { schema });
  return dbInstance;
};

export { schema };