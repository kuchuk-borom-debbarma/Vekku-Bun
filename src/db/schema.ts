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
    id: varchar().primaryKey(),
    username: varchar().notNull(),
    password: varchar().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => {
    return {
      usernameIdx: index("user_idx").on(table.username),
      usernamePwdIdx: index("user_username_password_idx").on(
        table.username,
        table.password,
      ),
    };
  },
);

export const userVerification = pgTable("user-verifications", {
  id: varchar("id").primaryKey(),
  email: varchar("email").notNull(),
  otp: varchar("otp").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

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
  (table) => {
    return {
      paginationIdx: index("tags_pagination_idx").on(
        table.userId,
        table.isDeleted,
        table.createdAt.desc(),
        table.id.desc(),
      ),
    };
  },
);
