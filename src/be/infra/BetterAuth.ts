import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      version: "1", // Increment this to invalidate all existing cookies
    },
  },
});
