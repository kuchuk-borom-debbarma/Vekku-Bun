import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

// Safe DB export that doesn't crash if DATABASE_URL is missing (e.g. during build or unit tests)
// We cast the fallback to NeonHttpDatabase so TypeScript provides full IntelliSense.
// In tests, this object is mocked. In production, missing config will (correctly) crash on usage.
export const db: NeonHttpDatabase = process.env.DATABASE_URL
  ? drizzle(process.env.DATABASE_URL)
  : ({} as unknown as NeonHttpDatabase);
