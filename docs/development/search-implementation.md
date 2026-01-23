# Search Implementation (ParadeDB & pg_search)

## Overview

We use **ParadeDB** (specifically the `pg_search` extension) to provide fast, fuzzy full-text search capabilities for tags. This replaces standard `ILIKE` queries with a BM25 ranking algorithm, which is the industry standard for search relevance.

## Architecture

### 1. Database Layer (PostgreSQL)

- **Extension:** `pg_search` (ParadeDB)
- **Index Type:** `bm25`
- **Indexed Columns:** `id`, `name`, `semantic` (in the `tags` table)
- **Key Field:** `id` (Required by ParadeDB for result linking)

The index allows us to search across multiple columns simultaneously and get results ranked by relevance rather than just boolean matching.

### 2. Schema Definition (`src/db/schema.ts`)

We define the BM25 index in Drizzle using the `.using("bm25", ...)` syntax.

```typescript
export const userTags = pgTable("tags", {
  // ... columns
}, (table) => [
  // Full text search index (ParadeDB / pg_search)
  index("tags_search_idx")
    .using("bm25", table.id, table.name, table.semantic)
    .with({ key_field: "id" }),
]);
```

### 3. Service Layer (`TagServiceImpl.ts`)

The search logic is encapsulated in `searchTags`.

- **Fuzzy Matching:** We append `~` to search terms (e.g., `apple~`) to handle typos.
- **Table-Wide Search:** We use the `@@@` operator on the table name (`tags`) to search all indexed columns (`name` and `semantic`) automatically.
- **Pagination:** Search uses **Offset-Based Pagination** (`limit` + `offset`) because relevance scoring makes cursor-based pagination complex.

```typescript
// Example Query Construction
const fuzzyQuery = query.split(/\s+/).map(w => `${w}~`).join(" ");

const rows = await db.select()
  .from(schema.userTags)
  .where(and(
    eq(schema.userTags.userId, userId),
    sql`tags @@@ ${fuzzyQuery}` // Search specifically within the user's scope
  ))
  .limit(limit)
  .offset(offset);
```

### 4. API Layer (`Routes.ts`)

The search is exposed via the standard `GET /tags` endpoint using a `q` query parameter.

- `GET /tags?q=apple` -> Calls `searchTags`
- `GET /tags` -> Calls `getTagsOfUser` (Standard cursor pagination)

## Key Implementation Notes

1.  **ParadeDB Specifics:**
    - The `key_field` option in the index definition is mandatory.
    - Searching `tags @@@ 'query'` is generally preferred for multi-column indexes over searching individual columns.

2.  **Migration Strategy:**
    - Drizzle Kit handles the `CREATE INDEX ... USING bm25` generation.
    - If `db:push` fails (common with complex extensions), manual SQL execution via `db.execute(sql.raw(...))` or stored procedures like `paradedb.create_bm25()` may be required.

## Troubleshooting

If search returns no results or throws errors:

1.  **Check Extension:** Ensure `pg_search` is installed (`SELECT extname FROM pg_extension`).
2.  **Check Index:** Verify `tags_search_idx` exists using `\d tags` in psql.
3.  **Rebuild Index:** Use `REINDEX INDEX tags_search_idx;` if data seems stale.
