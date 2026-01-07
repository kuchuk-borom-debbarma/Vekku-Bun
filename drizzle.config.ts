import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/be/user/_internal/entities/*.ts", "./src/be/tag/_internal/entities/*.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
