import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

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
