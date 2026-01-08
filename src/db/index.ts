import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export const getDb = (url: string) => {
  const client = neon(url);
  return drizzle(client, { schema });
};

export { schema };