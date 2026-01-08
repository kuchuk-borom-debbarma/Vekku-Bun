import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  text,
} from "drizzle-orm/pg-core";

// --- User Domain ---

export const user = pgTable(
  "users",
  {
    id: varchar({ length: 255 }).primaryKey(),
    username: text().notNull().unique(), // Email
    password: text().notNull(), // Hashed
    name: text().notNull(),
    role: text().default("user").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
  },
  (table) => [
    index("user_username_idx").on(table.username),
  ]
);

// --- Tag Domain ---

export const userTags = pgTable(
  "tags",
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar("fk_user_id", { length: 255 }).notNull(),
    name: text().notNull(),
    semantic: text().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
    isDeleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => [
    index("tags_pagination_idx").on(
      table.userId,
      table.isDeleted,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
