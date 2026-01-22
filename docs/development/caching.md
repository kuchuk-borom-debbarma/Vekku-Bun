# Caching Strategy & Architecture

## Overview

Vekku-Bun utilizes **Upstash Redis** for caching to ensure high performance and low latency, particularly for read-heavy operations like fetching content lists, tag lists, and suggestions. The caching layer is designed to be **platform-agnostic** (working in both Bun and Cloudflare Workers) by using the HTTP-based `@upstash/redis` client.

## Core Architecture

### 1. Service Wrapper (`src/lib/cache.ts`)
We abstract direct Redis calls behind a `CacheServiceUpstash` object. This provides a consistent API for:
- **Get:** Typed retrieval of objects.
- **Set:** Storing objects with TTL (Time-To-Live).
- **Key Generation:** Consistent naming conventions (`namespace:type:id`).
- **Invalidation:** Atomic deletion (`del`) and pattern-based bulk deletion (`delByPattern` using `SCAN`).

### 2. Connection
The Redis client is stateless, configured via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` injected at runtime. This fits the "Adapter Pattern" used throughout the application.

---

## Caching Patterns

### Read-Through Strategy
For data retrieval, we use a standard Read-Through pattern:
1. **Check Cache:** specific key.
2. **Hit:** Return cached data immediately.
3. **Miss:**
    - Query Database (Drizzle ORM).
    - Serialize data.
    - **Set Cache:** Store in Redis with a defined TTL (default 5 minutes).
    - Return data.

### Invalidation Strategy (Write-Invalidate)
We favor **invalidation** over updating the cache. When data changes:
1. **Update Database.**
2. **Delete Cached Keys:**
    - Remove specific entity keys (e.g., `contents:detail:123`).
    - **Bulk Remove** list pages using wildcards (e.g., `contents:list:user1:*`).

---

## Key Namespaces

| Namespace | Key Pattern | TTL | Description |
| :--- | :--- | :--- | :--- |
| **Contents** | `contents:detail:{contentId}` | 5m | Full content object. |
| **Contents** | `contents:list:{userId}:{chunkId}:{limit}:{offset}` | 5m | Paginated list chunk. |
| **Tags** | `tags:list:{userId}:{chunkId}:{limit}:{offset}` | 5m | Paginated tag list. |
| **Suggestions** | `suggestions:list:{userId}:{contentId}` | 5m | Scoped suggested tags for content. |
| **Admin** | `admin:stats` | 60s | System-wide counts (Users, Contents, Tags). |

---

## Detailed Flows

### 1. Content Management

**Read Flow (Get Content By ID):**
1. Check `contents:detail:{id}`.
2. If miss, fetch from DB -> Cache -> Return.

**Write Flow (Create Content):**
1. Insert into DB.
2. **Invalidate Lists:** `delByPattern("contents:list:{userId}:*")`. All paginated lists for that user are now stale.
3. Publish `CONTENT.CREATED` event.

**Write Flow (Update/Delete Content):**
1. Update/Delete in DB.
2. **Invalidate Detail:** `del("contents:detail:{id}")`.
3. **Invalidate Lists:** `delByPattern("contents:list:{userId}:*")`.
4. **Invalidate Suggestions:** `del("suggestions:list:{userId}:{id}")`.
5. Publish `CONTENT.UPDATED` / `CONTENT.DELETED` event.

---

### 2. Tag Management & "Nuclear" Invalidation

Tag library changes (deleting a tag or changing its semantic meaning) have a ripple effect on suggestions across *all* content. To avoid expensive AI-driven regeneration of every content piece, we use a **Nuclear Invalidation** strategy.

**Read Flow (Get Tags):**
- Checks `tags:list:{userId}:...`.

**Write Flow (Delete/Update Tag Semantic):**
1. Perform DB operation.
2. **Database Cascade:** The DB automatically removes the tag from `content_tag_suggestions` via `ON DELETE CASCADE`.
3. **Invalidate Tag Lists:** `delByPattern("tags:list:{userId}:*")`.
4. **Nuclear Suggestion Flush:** `delByPattern("suggestions:list:{userId}:*")`. 
    - This instantly marks all suggestions for this user as stale.
    - We **do not** re-run embedding logic. 
    - On next read, the API simply fetches the *remaining* valid suggestions from the DB.
5. Publish corresponding `TAG.*` event.

---

### 3. Suggestions (Event-Driven & Async)

Suggestions are unique because they are generated asynchronously via background listeners.

**The "Stale-While-Generating" Flow:**

1. **User Updates Content:**
    - API updates Content DB.
    - API publishes `CONTENT.UPDATED`.
    - API returns "Success" to user.

2. **User Views Content:**
    - API checks `suggestions:list:{userId}:{id}`.
    - Returns *existing* (potentially old) suggestions from Cache or DB.

3. **Background Worker (Listener):**
    - Receives `CONTENT.UPDATED`.
    - Generates new Embedding for content (Expensive AI Task).
    - Vector Search for matching tags.
    - **Writes** new suggestions to `content_tag_suggestions` table.
    - **INVALIDATION:** Calls `del("suggestions:list:{userId}:{id}")`.

4. **User Refreshes / Next View:**
    - API checks cache -> **MISS** (was deleted by worker).
    - API fetches fresh suggestions from DB.
    - API caches new suggestions.

---

## Implementation Details

### Bulk Invalidation (`delByPattern`)
Since Redis does not support `DEL pattern*` natively for performance reasons, we implemented a helper using `SCAN`:

```typescript
delByPattern: async (pattern: string) => {
  let cursor = 0;
  do {
    // Scan for keys matching pattern in batches of 100
    const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== 0);
}
```
*Warning: `SCAN` is O(N) over the keyspace, but safe for production as it doesn't block the main thread like `KEYS` would. Use specific patterns to minimize scan depth if possible.*
