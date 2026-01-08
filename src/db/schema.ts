import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  text,
} from "drizzle-orm/pg-core";

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