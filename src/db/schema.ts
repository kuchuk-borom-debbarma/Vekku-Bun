import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  text,
  uniqueIndex,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- User Domain ---

export const userRoles = pgEnum("user_role", ["USER", "ADMIN"]);

export const user = pgTable(
  "users",
  {
    id: varchar({ length: 255 }).primaryKey(),
    username: text().notNull().unique(), // Email
    password: text().notNull(), // Hashed
    name: text().notNull(),
    role: userRoles("role").default("USER").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
  },
  (table) => [index("user_username_idx").on(table.username)],
);

// --- User Tag Domain (Links) ---

export const userTags = pgTable(
  "tags",
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar("fk_user_id", { length: 255 }).notNull(),
    name: text().notNull(),
    semantic: text().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("tags_pagination_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("tags_semantic_idx").on(table.semantic),
    // Prevent duplicate tags for the same user
    uniqueIndex("unique_user_tag_active").on(table.userId, table.name),
    // Full text search index (ParadeDB / pg_search)
    index("tags_search_idx")
      .using("bm25", table.id, table.name, table.semantic)
      .with({ key_field: "id" }),
  ],
);

// --- Content Domain ---

export const contents = pgTable(
  "contents",
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar("fk_user_id", { length: 255 }).notNull(),
    title: text().notNull(),
    body: text().notNull(),
    contentType: text().notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("contents_pagination_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const contentSuggestions = pgTable(
  "content_suggestions",
  {
    id: varchar({ length: 255 }).primaryKey(),
    contentId: varchar("fk_content_id", { length: 255 })
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<{
      existing: { tagId: string; name: string; score: number }[];
      potential: { keyword: string; score: number }[];
    }>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("content_suggestions_content_id_unique").on(table.contentId),
  ],
);

export const contentTags = pgTable(
  "content_tags",
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar("fk_user_id", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentId: varchar("fk_content_id", { length: 255 })
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    tagId: varchar("fk_tag_id", { length: 255 })
      .notNull()
      .references(() => userTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("content_tags_idx_user_content_tag").on(
      table.userId,
      table.contentId,
      table.tagId,
    ),
    index("content_tags_tag_id_idx").on(table.tagId),
    index("content_tags_content_id_idx").on(table.contentId),
  ],
);
