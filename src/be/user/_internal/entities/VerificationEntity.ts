import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const userVerification = pgTable("user-verifications", {
  id: varchar("id").primaryKey(),
  email: varchar("email").notNull(),
  otp: varchar("otp").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
