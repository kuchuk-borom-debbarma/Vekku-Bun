import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { contentTags, userTags } from "../../db/schema";
import type { ChunkPaginationData } from "../../lib/pagination";
import { generateUUID } from "../../lib/uuid";
import type { ContentTag, IContentTagService } from "./ContentTagService";
import { CacheServiceUpstash } from "../../lib/cache";

const SEGMENT_SIZE = 100;

export class ContentTagServiceImpl implements IContentTagService {
  async addTagsToContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean> {
    try {
      const db = getDb();

      const values = data.tagIds.map((tag) => {
        return {
          id: generateUUID(),
          userId: data.userId,
          tagId: tag,
          contentId: data.contentId,
          createdAt: new Date(),
        };
      });

      await db.insert(contentTags).values(values).onConflictDoNothing();

      // Invalidate Cache
      const cachePattern = CacheServiceUpstash.generateKey("content-tags", "list", data.contentId, "*");
      await CacheServiceUpstash.delByPattern(cachePattern);

      return true;
    } catch (err) {
      console.error(
        `Something went wrong when attempting to link tag and content: ${err}`,
      );
      return false;
    }
  }

  async removeTagsFromContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean> {
    try {
      if (data.tagIds.length === 0) return true;
      const db = getDb();
      await db
        .delete(contentTags)
        .where(
          and(
            eq(contentTags.contentId, data.contentId),
            eq(contentTags.userId, data.userId),
            inArray(contentTags.tagId, data.tagIds),
          ),
        );

      // Invalidate Cache
      const cachePattern = CacheServiceUpstash.generateKey("content-tags", "list", data.contentId, "*");
      await CacheServiceUpstash.delByPattern(cachePattern);

      return true;
    } catch (err) {
      console.error(`Error removing tags from content: ${err}`);
      return false;
    }
  }

  async getTagOfContent(data: {
    contentId: string;
    userId: string;
    tagId: string;
  }): Promise<ContentTag | null> {
    const db = getDb();
    const result = await db
      .select({
        id: contentTags.id,
        contentId: contentTags.contentId,
        tagId: contentTags.tagId,
        createdAt: contentTags.createdAt,
        name: userTags.name,
        semantic: userTags.semantic,
      })
      .from(contentTags)
      .leftJoin(userTags, eq(contentTags.tagId, userTags.id))
      .where(
        and(
          eq(contentTags.contentId, data.contentId),
          eq(contentTags.userId, data.userId),
          eq(contentTags.tagId, data.tagId),
        ),
      )
      .limit(1);

    const tag = result[0];
    if (!tag) return null;

    return {
      id: tag.id,
      contentId: tag.contentId,
      tagId: tag.tagId,
      createdAt: tag.createdAt,
      name: tag.name ?? "",
      semantic: tag.semantic ?? "",
    };
  }

  async getTagsOfContent(data: {
    contentId: string;
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<ContentTag>> {
    const { contentId, userId, chunkId = null, limit = 20, offset = 0 } = data;
    
    // Cache Check
    const cacheKey = CacheServiceUpstash.generateKey(
      "content-tags",
      "list",
      contentId,
      chunkId,
      limit,
      offset,
    );
    const cached = await CacheServiceUpstash.get<ChunkPaginationData<ContentTag>>(
      cacheKey,
    );
    if (cached) return cached;

    const db = getDb();

    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    let whereClause = and(
      eq(contentTags.contentId, contentId),
      eq(contentTags.userId, userId),
    );

    if (chunkId) {
      const [cursorTag] = await db
        .select({ createdAt: contentTags.createdAt })
        .from(contentTags)
        .where(
          and(
            eq(contentTags.id, chunkId),
            eq(contentTags.contentId, contentId),
            eq(contentTags.userId, userId),
          ),
        )
        .limit(1);

      if (cursorTag) {
        whereClause = and(
          eq(contentTags.contentId, contentId),
          eq(contentTags.userId, userId),
          sql`(${contentTags.createdAt}, ${contentTags.id}) <= (${cursorTag.createdAt}, ${chunkId})`,
        )!;
      }
    }

    const chunkIds = await db
      .select({ id: contentTags.id })
      .from(contentTags)
      .where(whereClause)
      .orderBy(desc(contentTags.createdAt), desc(contentTags.id))
      .limit(SEGMENT_SIZE + 1);

    const totalFound = chunkIds.length;
    const hasNextChunk = totalFound > SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? SEGMENT_SIZE : totalFound;
    const nextChunkId = hasNextChunk ? chunkIds[SEGMENT_SIZE]!.id : null;

    const pageIds = chunkIds.slice(offset, offset + limit).map((row) => row.id);

    let pageData: ContentTag[] = [];
    if (pageIds.length > 0) {
      const rows = await db
        .select({
          id: contentTags.id,
          contentId: contentTags.contentId,
          tagId: contentTags.tagId,
          createdAt: contentTags.createdAt,
          name: userTags.name,
          semantic: userTags.semantic,
        })
        .from(contentTags)
        .leftJoin(userTags, eq(contentTags.tagId, userTags.id))
        .where(inArray(contentTags.id, pageIds))
        .orderBy(desc(contentTags.createdAt), desc(contentTags.id));

      pageData = rows.map((tag) => ({
        id: tag.id,
        contentId: tag.contentId,
        tagId: tag.tagId,
        createdAt: tag.createdAt,
        name: tag.name ?? "",
        semantic: tag.semantic ?? "",
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
}