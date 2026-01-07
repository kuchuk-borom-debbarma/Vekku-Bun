import {
  boolean,
  pgTable,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";

export const userTags = pgTable("tags", {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar("fk_user_id", { length: 255 }).notNull(),
  name: text().notNull(),
  semantic: text().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
});
