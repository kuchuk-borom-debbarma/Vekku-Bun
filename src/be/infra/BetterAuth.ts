import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      strategy: "jwt",
      refreshCache: true,
    },
    account: {
      storeStateStrategy: "cookie",
      storeAccountCookie: true, // Store account data after OAuth flow in a cookie (useful for database-less flows)
    },
  },
});
