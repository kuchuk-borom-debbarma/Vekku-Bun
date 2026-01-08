import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { getDb } from "../db";

export const getAuth = (databaseUrl: string) => {
  const db = getDb(databaseUrl);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          console.log(`Magic link for ${email}: ${url}`);
          // In production, you'd use an email service here.
        },
      }),
    ],
  });
};

// For CLI tools (drizzle-kit, better-auth cli)
// It will use the DATABASE_URL from .env
export const auth = getAuth(process.env.DATABASE_URL!);
