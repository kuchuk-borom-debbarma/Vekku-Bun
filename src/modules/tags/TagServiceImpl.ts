import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { generateUUID, normalize } from "../../lib/uuid";
import type { ChunkPaginationData } from "../../lib/pagination";
import type { ITagService, UserTag } from "./TagService";
import { getDb } from "../../db";
import { getEventBus, TOPICS } from "../../lib/events";
import { CacheServiceUpstash } from "../../lib/cache";

const SEGMENT_SIZE = 2000;

export class TagServiceImpl implements ITagService {
  async createTag(
    data: {
      name: string;
      semantic: string;
      userId: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<UserTag | null> {
    const db = getDb();

    // Fallback to name if semantic is empty
    const semanticInput = data.semantic && data.semantic.trim().length > 0 ? data.semantic : data.name;
    const normalizedSemantic = normalize(semanticInput);

    const tagId = generateUUID();

    const result = await db
      .insert(schema.userTags)
      .values({
        id: tagId,
        userId: data.userId,
        name: data.name,
        semantic: normalizedSemantic,
      })
      .onConflictDoUpdate({
        target: [schema.userTags.userId, schema.userTags.name],
        set: {
          updatedAt: new Date(),
          name: data.name,
          semantic: normalizedSemantic,
        },
      })
      .returning();

    const tag = result[0];
    if (tag) {
      console.log(`[TagService] Tag Created: ${tag.name} (${tag.id})`);
      const userTag = {
        id: tag.id,
        name: tag.name,
        semantic: tag.semantic,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      };

      // Invalidate List Cache
      const listCachePattern = CacheServiceUpstash.generateKey("tags", "list", tag.userId, "*");
      const suggestionCachePattern = CacheServiceUpstash.generateKey("suggestions", "list", tag.userId, "*");
      const contentTagsCachePattern = CacheServiceUpstash.generateKey("content-tags", "list", tag.userId, "*");
      
      await Promise.all([
        CacheServiceUpstash.delByPattern(listCachePattern),
        CacheServiceUpstash.delByPattern(suggestionCachePattern),
        CacheServiceUpstash.delByPattern(contentTagsCachePattern),
      ]);

      /**
       * EVENT-DRIVEN ARCHITECTURE (Asynchronous Learning)
       * -------------------------------------------------
       * Instead of generating the vector embedding immediately (which is slow and calls external APIs),
       * we publish a 'TAG.CREATED' event.
       *
       * 1. The HTTP response is returned immediately to the user (Fast UI).
       * 2. The 'Listeners.ts' module picks up this event in the background.
       * 3. It generates the embedding and updates the 'tag_embeddings' table.
       *
       * The 'ctx.waitUntil' ensures the Cloudflare Worker stays alive until the event is processed.
       */
      try {
        console.log(`[TagService] Publishing TAG.CREATED event for: ${tag.name}`);
        getEventBus().publish(TOPICS.TAG.CREATED, userTag, tag.userId, ctx);
      } catch (e) {
        console.error("Failed to publish tag.created event:", e);
      }

      return userTag;
    }
    return null;
  }

  async updateTag(
    data: {
      id: string;
      userId: string;
      name?: string;
      semantic?: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<UserTag | null> {
    const db = getDb();

    // 1. Fetch Existing Tag first to ensure we have context
    const existing = await db
      .select({ name: schema.userTags.name })
      .from(schema.userTags)
      .where(
        and(
          eq(schema.userTags.id, data.id),
          eq(schema.userTags.userId, data.userId),
        ),
      )
      .limit(1);

    if (existing.length === 0) return null;
    const currentTag = existing[0];

    const toUpdate: { name?: string; semantic?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (data.name) toUpdate.name = data.name;

    if (data.semantic !== undefined) {
      const trimmed = data.semantic.trim();
      if (trimmed.length === 0) {
        // Fallback: Use new name if provided, otherwise existing name
        const fallbackName = data.name || (currentTag ? currentTag.name : "");
        toUpdate.semantic = normalize(fallbackName);
      } else {
        toUpdate.semantic = normalize(data.semantic);
      }
    }

    const result = await db
      .update(schema.userTags)
      .set(toUpdate)
      .where(
        and(
          eq(schema.userTags.id, data.id),
          eq(schema.userTags.userId, data.userId),
        ),
      )
      .returning();

    const tag = result[0];
    if (tag) {
      console.log(`[TagService] Tag Updated: ${tag.name} (${tag.id})`);
      const userTag = {
        id: tag.id,
        name: tag.name,
        semantic: tag.semantic,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      };

      // Invalidate List Cache
      const listCachePattern = CacheServiceUpstash.generateKey("tags", "list", tag.userId, "*");
      const suggestionCachePattern = CacheServiceUpstash.generateKey("suggestions", "list", tag.userId, "*");
      const contentTagsCachePattern = CacheServiceUpstash.generateKey("content-tags", "list", tag.userId, "*");
      
      await Promise.all([
        CacheServiceUpstash.delByPattern(listCachePattern),
        CacheServiceUpstash.delByPattern(suggestionCachePattern),
        CacheServiceUpstash.delByPattern(contentTagsCachePattern),
      ]);

      // Publish Event
      try {
        console.log(`[TagService] Publishing TAG.UPDATED event for: ${tag.name}`);
        getEventBus().publish(TOPICS.TAG.UPDATED, userTag, tag.userId, ctx);
      } catch (e) {
        console.error("Failed to publish tag.updated event:", e);
      }

      return userTag;
    }
    return null;
  }

  async deleteTag(
    data: { id: string; userId: string },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(schema.userTags)
      .where(
        and(
          eq(schema.userTags.id, data.id),
          eq(schema.userTags.userId, data.userId),
        ),
      )
      .returning();

    if (result.length > 0) {
      // Invalidate List Cache
      const listCachePattern = CacheServiceUpstash.generateKey("tags", "list", data.userId, "*");
      await CacheServiceUpstash.delByPattern(listCachePattern);

      // Publish Event
      try {
        getEventBus().publish(
          TOPICS.TAG.DELETED,
          { id: data.id, userId: data.userId },
          data.userId,
          ctx,
        );
      } catch (e) {
        console.error("Failed to publish tag.deleted event:", e);
      }
      return true;
    }

    return false;
  }

  async getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>> {
    const { userId, chunkId = null, limit = 20, offset = 0 } = data;

    // Cache Check
    const cacheKey = CacheServiceUpstash.generateKey(
      "tags",
      "list",
      userId,
      chunkId,
      limit,
      offset,
    );
    const cached = await CacheServiceUpstash.get<ChunkPaginationData<UserTag>>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const db = getDb();
    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    // 1. Resolve Cursor
    let whereClause = eq(schema.userTags.userId, userId);

    if (chunkId) {
      const [cursorTag] = await db
        .select({ createdAt: schema.userTags.createdAt })
        .from(schema.userTags)
        .where(
          and(
            eq(schema.userTags.id, chunkId),
            eq(schema.userTags.userId, userId),
          ),
        )
        .limit(1);

      if (cursorTag) {
        whereClause = and(
          eq(schema.userTags.userId, userId),
          sql`(${schema.userTags.createdAt}, ${schema.userTags.id}) <= (${cursorTag.createdAt}, ${chunkId})`,
        )!;
      }
    }

    // 2. Fetch Chunk IDs
    const chunkIds = await db
      .select({ id: schema.userTags.id })
      .from(schema.userTags)
      .where(whereClause)
      .orderBy(desc(schema.userTags.createdAt), desc(schema.userTags.id))
      .limit(SEGMENT_SIZE + 1);

    // 3. Metadata
    const totalFound = chunkIds.length;
    const hasNextChunk = totalFound > SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? SEGMENT_SIZE : totalFound;
    const nextChunkId = hasNextChunk ? chunkIds[SEGMENT_SIZE]!.id : null;

    // 4. Page IDs
    const pageIds = chunkIds.slice(offset, offset + limit).map((row) => row.id);

    // 5. Fetch Full Data (No Join needed anymore)
    let pageData: UserTag[] = [];
    if (pageIds.length > 0) {
      const rows = await db
        .select()
        .from(schema.userTags)
        .where(inArray(schema.userTags.id, pageIds));

      const idMap = new Map(rows.map((r) => [r.id, r]));

      pageData = pageIds
        .map((id) => idMap.get(id))
        .filter((item) => item !== undefined)
        .map((row) => ({
          id: row!.id,
          name: row!.name,
          semantic: row!.semantic,
          userId: row!.userId,
          createdAt: row!.createdAt,
          updatedAt: row!.updatedAt,
        }));
    }

    const result = {
      data: pageData,
      metadata: {
        nextChunkId,
        chunkSize: SEGMENT_SIZE,
        chunkTotalItems,
        limit,
        offset,
      },
    };

    // Cache Set
    await CacheServiceUpstash.set(cacheKey, result);

    return result;
  }

  async searchTags(data: {
    userId: string;
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>> {
    const { userId, query, limit = 10, offset = 0 } = data;
    const db = getDb();

    // ParadeDB BM25 Search
    // Dynamic Fuzziness:
    // - Length <= 2: Exact match
    // - Length === 3: Allow ~1 edit (moderate)
    // - Length >= 4: Allow ~2 edits (aggressive, captures 'jawe'->'java', 'genuis'->'genius')
    const fuzzyQuery = query
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (word.length <= 2) return word;
        if (word.length === 3) return `${word}~1`;
        return `${word}~2`;
      })
      .join(" ");

    const rows = await db
      .select()
      .from(schema.userTags)
      .where(
        and(
          eq(schema.userTags.userId, userId),
          // Explicitly search name OR semantic to avoid table alias issues
          sql`(${schema.userTags.name} @@@ ${fuzzyQuery} OR ${schema.userTags.semantic} @@@ ${fuzzyQuery})`,
        ),
      )
      .limit(limit)
      .offset(offset);

    const pageData = rows.map((row) => ({
      id: row.id,
      name: row.name,
      semantic: row.semantic,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    // For total search results count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.userTags)
      .where(
        and(
          eq(schema.userTags.userId, userId),
          sql`(${schema.userTags.name} @@@ ${fuzzyQuery} OR ${schema.userTags.semantic} @@@ ${fuzzyQuery})`,
        ),
      );
    const totalFound = totalResult[0]?.count || 0;

    return {
      data: pageData,
      metadata: {
        nextChunkId: null, // Search uses offset, not ID cursors
        chunkSize: limit, // In search context, chunk size is effectively the limit
        chunkTotalItems: totalFound, // Total found across all pages
        limit,
        offset,
      },
    };
  }

  async getTagsByIds(tagIds: string[], userId: string): Promise<UserTag[]> {
    if (tagIds.length === 0) return [];
    const db = getDb();
    
    const rows = await db
      .select()
      .from(schema.userTags)
      .where(and(inArray(schema.userTags.id, tagIds), eq(schema.userTags.userId, userId)));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      semantic: row.semantic,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
