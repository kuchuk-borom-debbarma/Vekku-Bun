import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  text,
  vector,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  (table) => [index("user_username_idx").on(table.username)],
);

// --- Tag Concept Domain (Embeddings) ---

export const tagEmbeddings = pgTable(
  "tag_embeddings",
  {
    id: varchar({ length: 255 }).primaryKey(), // Deterministic UUID based on semantic
    semantic: text().notNull(),
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    // HNSW Index for fast cosine similarity search
    index("embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    // Ensure uniqueness so multiple users map to the same embedding entry
    uniqueIndex("unique_tag_concept").on(table.semantic),
  ],
);

// --- User Tag Domain (Links) ---

export const userTags = pgTable(
  "tags",
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: varchar("fk_user_id", { length: 255 }).notNull(),
    name: text().notNull(),
    embeddingId: varchar("fk_embedding_id", { length: 255 })
      .notNull()
      .references(() => tagEmbeddings.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("tags_pagination_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // Prevent duplicate tags for the same user
    uniqueIndex("unique_user_tag_active")
      .on(table.userId, table.name),
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

// --- Tag Suggestions Domain ---

export const contentTagSuggestions = pgTable(
  "content_tag_suggestions",
  {
    id: varchar({ length: 255 }).primaryKey(),
    contentId: varchar("fk_content_id", { length: 255 }).notNull(),
    tagId: varchar("fk_tag_id", { length: 255 }).notNull(),
    userId: varchar("fk_user_id", { length: 255 }).notNull(),
    score: text().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("content_tag_suggestions_content_idx").on(table.contentId),
    index("content_tag_suggestions_tag_idx").on(table.tagId),
  ],
);
