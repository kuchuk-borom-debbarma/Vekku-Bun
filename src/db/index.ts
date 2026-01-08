import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const getDb = (url: string): NeonHttpDatabase<typeof schema> => {
  return drizzle(url, { schema });
};

// Export schema for convenience
export * from "./schema";
