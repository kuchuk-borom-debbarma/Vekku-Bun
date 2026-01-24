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
      // Atomic increment of tagCount ONLY if it was an insert (updatedAt is null)
      if (!tag.updatedAt) {
        await db.execute(sql`
          UPDATE users 
          SET metadata = jsonb_set(
            metadata, 
            '{tagCount}', 
            (COALESCE((metadata->>'tagCount')::int, 0) + 1)::text::jsonb
          )
          WHERE id = ${data.userId}
        `);
      }

      console.log(`[TagService] Tag Created: ${tag.name} (${tag.id})`);
      const userTag: UserTag = {
        id: tag.id,
        name: tag.name,
        semantic: tag.semantic,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      };

      // Invalidate Caches
      await this.invalidateUserTagCaches(tag.userId);

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

  async createTags(
    data: {
      name: string;
      semantic: string;
      userId: string;
    }[],
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<UserTag[]> {
    if (data.length === 0) return [];
    
    const db = getDb();
    const userId = data[0]!.userId;

    const values = data.map(d => ({
      id: generateUUID(),
      userId: d.userId,
      name: d.name,
      semantic: normalize(d.semantic || d.name),
    }));

    const results = await db
      .insert(schema.userTags)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.userTags.userId, schema.userTags.name],
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    if (results.length > 0) {
      // Atomic increment of tagCount by the number of NEWLY inserted tags
      const newTagsCount = results.filter(r => !r.updatedAt).length;
      
      if (newTagsCount > 0) {
        await db.execute(sql`
          UPDATE users 
          SET metadata = jsonb_set(
            metadata, 
            '{tagCount}', 
            (COALESCE((metadata->>'tagCount')::int, 0) + ${newTagsCount})::text::jsonb
          )
          WHERE id = ${userId}
        `);
      }

      // Invalidate Caches
      await this.invalidateUserTagCaches(userId);

      // Publish Events
      for (const tag of results) {
        try {
          getEventBus().publish(TOPICS.TAG.CREATED, tag, userId, ctx);
        } catch (e) {
          console.error("Failed to publish tag.created event:", e);
        }
      }
    }

    return results.map(tag => ({
      id: tag.id,
      name: tag.name,
      semantic: tag.semantic,
      userId: tag.userId,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }));
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

      // Invalidate Caches
      await this.invalidateUserTagCaches(tag.userId);

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
      // Atomic decrement of tagCount
      await db.execute(sql`
        UPDATE users 
        SET metadata = jsonb_set(
          metadata, 
          '{tagCount}', 
          (GREATEST(COALESCE((metadata->>'tagCount')::int, 0) - 1, 0))::text::jsonb
        )
        WHERE id = ${data.userId}
      `);

      // Invalidate Caches
      await this.invalidateUserTagCaches(data.userId);

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

    if (!query.trim()) {
      return {
        data: [],
        metadata: { nextChunkId: null, chunkSize: limit, chunkTotalItems: 0, limit, offset },
      };
    }

    const words = query.trim().split(/\s+/);

    /**
     * Helper to build a ParadeDB term expression.
     * We use raw SQL strings for the function calls because they require
     * specific named parameter syntax (field => '...', value => '...')
     */
    const buildTerm = (word: string, field: "name" | "semantic") => {
      const safeWord = word.replace(/'/g, "''");
      const len = word.length;

      if (len <= 2) {
        return sql.raw(`paradedb.term(field => '${field}', value => '${safeWord}')`);
      }
      
      // 3-tier fuzzy logic
      const distance = len === 3 ? 1 : 2;
      return sql.raw(
        `paradedb.fuzzy_term(field => '${field}', value => '${safeWord}', distance => ${distance})`
      );
    };

    // Construct conditions for each word: (name @@@ fuzzy(w) OR semantic @@@ fuzzy(w))
    const wordConditions = words.map((word) => {
      const nameFuzzy = buildTerm(word, "name");
      const semanticFuzzy = buildTerm(word, "semantic");
      return sql`(${schema.userTags.name} @@@ ${nameFuzzy} OR ${schema.userTags.semantic} @@@ ${semanticFuzzy})`;
    });

    const finalSearchCondition = and(
      eq(schema.userTags.userId, userId),
      ...wordConditions
    );

    const [rows, totalResult] = await Promise.all([
      db.select().from(schema.userTags).where(finalSearchCondition).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(schema.userTags).where(finalSearchCondition),
    ]);

    const pageData = rows.map((row) => ({
      id: row.id,
      name: row.name,
      semantic: row.semantic,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    const totalFound = Number(totalResult[0]?.count || 0);

    return {
      data: pageData,
      metadata: {
        nextChunkId: null,
        chunkSize: limit,
        chunkTotalItems: totalFound,
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

  private async invalidateUserTagCaches(userId: string) {
    const listCachePattern = CacheServiceUpstash.generateKey("tags", "list", userId, "*");
    const suggestionCachePattern = CacheServiceUpstash.generateKey("suggestions", "*", userId, "*");
    const contentTagsCachePattern = CacheServiceUpstash.generateKey("content-tags", "list", userId, "*");
    const filteredContentCachePattern = CacheServiceUpstash.generateKey("contents", "list-filtered", userId, "*");

    await Promise.all([
      CacheServiceUpstash.delByPattern(listCachePattern),
      CacheServiceUpstash.delByPattern(suggestionCachePattern),
      CacheServiceUpstash.delByPattern(contentTagsCachePattern),
      CacheServiceUpstash.delByPattern(filteredContentCachePattern),
    ]);
  }
}
