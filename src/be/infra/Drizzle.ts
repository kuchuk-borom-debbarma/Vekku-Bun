import { drizzle } from "drizzle-orm/neon-http";

const getDb = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Return a proxy or dummy if URL is missing (useful for some test runners)
    // but better to just let the mock handle it if possible.
    // For now, let's keep it simple and just export it.
    return null as any;
  }
  return drizzle(url);
};

export const db = process.env.DATABASE_URL ? drizzle(process.env.DATABASE_URL) : ({} as any);
