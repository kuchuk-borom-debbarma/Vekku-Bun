import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as baseSchema from "./schema";
import * as authSchema from "./auth-schema";

export const schema = { ...baseSchema, ...authSchema };

export const getDb = (url: string) => {
  const client = neon(url);
  return drizzle(client, { schema });
};
