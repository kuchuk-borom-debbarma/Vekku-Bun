import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import type { ChunkPaginationData } from "../../lib/pagination";
import {
  type Content,
  ContentType,
  type IContentService,
} from "./ContentService";
import { getEventBus, TOPICS } from "../../lib/events";
import { CacheServiceUpstash } from "../../lib/cache";
import { getYouTubeService } from "../youtube/YouTubeService";

const SEGMENT_SIZE = 20;

export class ContentServiceImpl implements IContentService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async createYoutubeContent(data: {
    url: string;
    userId: string;
    userTitle?: string;
    userDescription?: string;
    transcript?: string;
    tagIds?: string[];
  }): Promise<Content | null> {
    const youtubeService = getYouTubeService();
    const videoId = youtubeService.extractVideoId(data.url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    let transcriptText = data.transcript;
    let originalTitle = "YouTube Video";

    // Fallback: fetch if not provided
    if (!transcriptText) {
        const fetched = await youtubeService.getTranscript(videoId);
        if (fetched) {
            transcriptText = fetched.text;
            originalTitle = fetched.title;
        }
    }

    const title = data.userTitle || originalTitle;
    const body = `${title}\n\n${data.userDescription || ""}\n\n${transcriptText || ""}`;

    const metadata = {
        youtubeUrl: data.url,
        videoId,
        originalTitle,
        userDescription: data.userDescription,
        transcript: transcriptText,
    };

    return this.createContentInternal({
        title,
        body,
        contentType: ContentType.YOUTUBE_VIDEO,
        userId: data.userId,
        metadata,
    });
  }

  async createTextContent(
    data: {
      title: string;
      content: string;
      contentType: ContentType;
      userId: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<Content | null> {
    return this.createContentInternal({
        title: data.title,
        body: data.content,
        contentType: data.contentType,
        userId: data.userId,
        metadata: {},
    }, ctx);
  }

  private async createContentInternal(data: {
      title: string;
      body: string;
      contentType: ContentType;
      userId: string;
      metadata: any;
  }, ctx?: { waitUntil: (promise: Promise<any>) => void }): Promise<Content | null> {
    // Validation
    if (!data.title || !data.userId) {
        throw new Error("Invalid data");
    }

    const result = await this.db
      .insert(schema.contents)
      .values({
        id: generateUUID(),
        title: data.title,
        body: data.body,
        contentType: data.contentType,
        userId: data.userId,
        metadata: data.metadata,
      })
      .returning();

    const content = result[0];
    if (!content) return null;

    await this.db.execute(sql`
      UPDATE users
      SET metadata = jsonb_set(
        metadata,
        '{contentCount}',
        (COALESCE((metadata->>'contentCount')::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${data.userId}
    `);

    console.log(
      `[ContentService] Content Created: ${content.title} (${content.id})`,
    );

    const listCachePattern = CacheServiceUpstash.generateKey(
      "contents",
      "list",
      data.userId,
      "*",
    );
    const filteredListCachePattern = CacheServiceUpstash.generateKey(
      "contents",
      "list-filtered",
      data.userId,
      "*",
    );
    await Promise.all([
      CacheServiceUpstash.delByPattern(listCachePattern),
      CacheServiceUpstash.delByPattern(filteredListCachePattern),
    ]);

    try {
      const eventBus = getEventBus();
      console.log(
        `[ContentService] Publishing CONTENT.CREATED event for: ${content.id}`,
      );
      eventBus.publish(
        TOPICS.CONTENT.CREATED,
        {
          id: content.id,
          title: content.title,
          body: content.body,
          userId: content.userId,
          contentType: content.contentType as ContentType,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
        },
        content.userId,
        ctx,
      );
    } catch (e) {
      console.error("Failed to publish content.created event:", e);
    }

    return {
      id: content.id,
      title: content.title,
      body: content.body,
      userId: content.userId,
      contentType: content.contentType as ContentType,
      metadata: content.metadata,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  async updateContent(
    data: {
      id: string;
      userId: string;
      title?: string;
      content?: string;
      contentType?: ContentType;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<Content | null> {
    const toUpdate: {
      title?: string;
      body?: string;
      contentType?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (data.title) toUpdate.title = data.title;
    if (data.content) toUpdate.body = data.content;
    if (data.contentType) toUpdate.contentType = data.contentType;

    const result = await this.db
      .update(schema.contents)
      .set(toUpdate)
      .where(
        and(
          eq(schema.contents.id, data.id),
          eq(schema.contents.userId, data.userId),
        ),
      )
      .returning();

    const content = result[0];
    if (!content) return null;

    console.log(
      `[ContentService] Content Updated: ${content.title} (${content.id})`,
    );

    const detailCacheKey = CacheServiceUpstash.generateKey(
      "contents",
      "detail",
      content.id,
    );
    const listCachePattern = CacheServiceUpstash.generateKey(
      "contents",
      "list",
      content.userId,
      "*",
    );
    const filteredListCachePattern = CacheServiceUpstash.generateKey(
      "contents",
      "list-filtered",
      content.userId,
      "*",
    );
    const suggestionCachePattern = CacheServiceUpstash.generateKey(
      "suggestions",
      "*",
      content.userId,
      content.id,
    );
    await Promise.all([
      CacheServiceUpstash.del(detailCacheKey),
      CacheServiceUpstash.delByPattern(listCachePattern),
      CacheServiceUpstash.delByPattern(filteredListCachePattern),
      CacheServiceUpstash.delByPattern(suggestionCachePattern),
    ]);

    if (data.content) {
      try {
        const eventBus = getEventBus();
        console.log(
          `[ContentService] Publishing CONTENT.UPDATED event for: ${content.id}`,
        );
        eventBus.publish(
          TOPICS.CONTENT.UPDATED,
          {
            id: content.id,
            title: content.title,
            body: content.body,
            userId: content.userId,
            contentType: content.contentType as ContentType,
            createdAt: content.createdAt,
            updatedAt: content.updatedAt,
          },
          content.userId,
          ctx,
        );
      } catch (e) {
        console.error("Failed to publish content.updated event:", e);
      }
    }

    return {
      id: content.id,
      title: content.title,
      body: content.body,
      userId: content.userId,
      contentType: content.contentType as ContentType,
      metadata: content.metadata,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  async deleteContent(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.contents)
      .where(
        and(eq(schema.contents.id, id), eq(schema.contents.userId, userId)),
      )
      .returning();

    if (result.length > 0) {
      await this.db.execute(sql`
        UPDATE users
        SET metadata = jsonb_set(
          metadata,
          '{contentCount}',
          (GREATEST(COALESCE((metadata->>'contentCount')::int, 0) - 1, 0))::text::jsonb
        )
        WHERE id = ${userId}
      `);

      const detailCacheKey = CacheServiceUpstash.generateKey(
        "contents",
        "detail",
        id,
      );
      const listCachePattern = CacheServiceUpstash.generateKey(
        "contents",
        "list",
        userId,
        "*",
      );
      const filteredListCachePattern = CacheServiceUpstash.generateKey(
        "contents",
        "list-filtered",
        userId,
        "*",
      );
      const suggestionCachePattern = CacheServiceUpstash.generateKey(
        "suggestions",
        "*",
        userId,
        id,
      );
      const contentTagsCachePattern = CacheServiceUpstash.generateKey(
        "content-tags",
        "list",
        id,
        "*",
      );

      await Promise.all([
        CacheServiceUpstash.del(detailCacheKey),
        CacheServiceUpstash.delByPattern(listCachePattern),
        CacheServiceUpstash.delByPattern(filteredListCachePattern),
        CacheServiceUpstash.delByPattern(suggestionCachePattern),
        CacheServiceUpstash.delByPattern(contentTagsCachePattern),
      ]);

      try {
        const eventBus = getEventBus();
        eventBus.publish(TOPICS.CONTENT.DELETED, { id, userId }, userId);
      } catch (e) {
        console.error("Failed to publish content.deleted event:", e);
      }
      return true;
    }

    return false;
  }

  async getContentById(id: string): Promise<Content | null> {
    const cacheKey = CacheServiceUpstash.generateKey("contents", "detail", id);
    const cached = await CacheServiceUpstash.get<Content>(cacheKey);
    if (cached) return cached;

    const result = await this.db
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.id, id))
      .limit(1);

    const content = result[0];
    if (!content) return null;

    const data = {
      id: content.id,
      title: content.title,
      body: content.body,
      userId: content.userId,
      contentType: content.contentType as ContentType,
      metadata: content.metadata,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };

    await CacheServiceUpstash.set(cacheKey, data);

    return data;
  }

  async getContentsByUserId(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    chunkId?: string,
  ): Promise<ChunkPaginationData<Content>> {
    const cacheKey = CacheServiceUpstash.generateKey(
      "contents",
      "list",
      userId,
      chunkId,
      limit,
      offset,
    );
    const cached =
      await CacheServiceUpstash.get<ChunkPaginationData<Content>>(cacheKey);
    if (cached) return cached;

    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    let whereClause = eq(schema.contents.userId, userId);

    if (chunkId) {
      const [cursorContent] = await this.db
        .select({ createdAt: schema.contents.createdAt })
        .from(schema.contents)
        .where(
          and(
            eq(schema.contents.id, chunkId),
            eq(schema.contents.userId, userId),
          ),
        )
        .limit(1);

      if (cursorContent) {
        whereClause = and(
          eq(schema.contents.userId, userId),
          sql`(${schema.contents.createdAt}, ${schema.contents.id}) <= (${cursorContent.createdAt}, ${chunkId})`,
        )!;
      }
    }

    const chunkIds = await this.db
      .select({ id: schema.contents.id })
      .from(schema.contents)
      .where(whereClause)
      .orderBy(desc(schema.contents.createdAt), desc(schema.contents.id))
      .limit(SEGMENT_SIZE + 1);

    const totalFound = chunkIds.length;
    const hasNextChunk = totalFound > SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? SEGMENT_SIZE : totalFound;
    const nextChunkId = hasNextChunk ? chunkIds[SEGMENT_SIZE]!.id : null;

    const pageIds = chunkIds
      .slice(offset, offset + limit)
      .map((row: { id: string }) => row.id);

    let pageData: Content[] = [];
    if (pageIds.length > 0) {
      const rows = await this.db
        .select()
        .from(schema.contents)
        .where(inArray(schema.contents.id, pageIds));

      const idMap = new Map(rows.map((r) => [r.id, r]));
      pageData = pageIds
        .map((id) => idMap.get(id)!)
        .filter((item) => item !== undefined)
        .map((content) => ({
          id: content.id,
          title: content.title,
          body: content.body,
          userId: content.userId,
          contentType: content.contentType as ContentType,
          metadata: content.metadata,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
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

    await CacheServiceUpstash.set(cacheKey, result);

    return result;
  }

  async getContentsByTags(
    userId: string,
    tagIds: string[],
    limit: number = 20,
    offset: number = 0,
    chunkId?: string,
  ): Promise<ChunkPaginationData<Content>> {
    const cacheKey = CacheServiceUpstash.generateKey(
      "contents",
      "list-filtered",
      userId,
      tagIds.sort().join(","),
      chunkId || "root",
      limit,
      offset,
    );
    const cached =
      await CacheServiceUpstash.get<ChunkPaginationData<Content>>(cacheKey);
    if (cached) return cached;

    if (tagIds.length === 0) {
      return {
        data: [],
        metadata: {
          nextChunkId: null,
          chunkSize: limit,
          chunkTotalItems: 0,
          limit,
          offset,
        },
      };
    }

    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    // 1. Resolve Cursor for chunking
    let cursorCondition = sql`TRUE`;
    if (chunkId) {
      const [cursorContent] = await this.db
        .select({ createdAt: schema.contents.createdAt })
        .from(schema.contents)
        .where(
          and(
            eq(schema.contents.id, chunkId),
            eq(schema.contents.userId, userId),
          ),
        )
        .limit(1);

      if (cursorContent) {
        cursorCondition = sql`(${schema.contents.createdAt}, ${schema.contents.id}) <= (${cursorContent.createdAt}, ${chunkId})`;
      }
    }

    const chunkIdsQuery = await this.db
      .select({ id: schema.contentTags.contentId })
      .from(schema.contentTags)
      .innerJoin(
        schema.contents,
        eq(schema.contentTags.contentId, schema.contents.id),
      )
      .where(
        and(
          eq(schema.contentTags.userId, userId),
          inArray(schema.contentTags.tagId, tagIds),
          cursorCondition,
        ),
      )
      .groupBy(schema.contentTags.contentId, schema.contents.createdAt)
      .having(
        sql`count(distinct ${schema.contentTags.tagId}) = ${tagIds.length}`,
      )
      .orderBy(
        desc(schema.contents.createdAt),
        desc(schema.contentTags.contentId),
      )
      .limit(SEGMENT_SIZE + 1);

    const totalFoundInSegment = chunkIdsQuery.length;
    const hasNextChunk = totalFoundInSegment > SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? SEGMENT_SIZE : totalFoundInSegment;
    const nextChunkId = hasNextChunk ? chunkIdsQuery[SEGMENT_SIZE]!.id : null;

    const pageIds = chunkIdsQuery
      .slice(offset, offset + limit)
      .map((row) => row.id);

    let pageData: Content[] = [];
    if (pageIds.length > 0) {
      const rows = await this.db
        .select()
        .from(schema.contents)
        .where(inArray(schema.contents.id, pageIds));

      const idMap = new Map(rows.map((r) => [r.id, r]));
      pageData = pageIds
        .map((id) => idMap.get(id)!)
        .filter((item) => item !== undefined)
        .map((content) => ({
          id: content.id,
          title: content.title,
          body: content.body,
          userId: content.userId,
          contentType: content.contentType as ContentType,
          metadata: content.metadata,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
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

    await CacheServiceUpstash.set(cacheKey, result);

    return result;
  }
}