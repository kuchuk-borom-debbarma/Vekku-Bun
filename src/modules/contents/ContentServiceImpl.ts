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

const SEGMENT_SIZE = 20;

export class ContentServiceImpl implements IContentService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async createContent(
    data: {
      title: string;
      content: string;
      contentType: ContentType;
      userId: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<Content | null> {
    //validation
    if (!data.title || !data.content || !data.userId) {
      throw new Error("Invalid data");
    }

    const result = await this.db
      .insert(schema.contents)
      .values({
        id: generateUUID(),
        title: data.title,
        body: data.content,
        contentType: data.contentType,
        userId: data.userId,
      })
      .returning();

    const content = result[0];
    if (!content) return null;

    console.log(
      `[ContentService] Content Created: ${content.title} (${content.id})`,
    );

    // Invalidate List Cache
    const listCachePattern = CacheServiceUpstash.generateKey("contents", "list", data.userId, "*");
    await CacheServiceUpstash.delByPattern(listCachePattern);

    // Trigger Event-Driven Suggestions
    try {
      const eventBus = getEventBus();
      console.log(
        `[ContentService] Publishing CONTENT.CREATED event for: ${content.id}`,
      );
      // We don't await here to return to the user faster.
      // If ctx is provided, eventBus.publish will use ctx.waitUntil internally.
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

    // Invalidate Caches
    const detailCacheKey = CacheServiceUpstash.generateKey("contents", "detail", content.id);
    const listCachePattern = CacheServiceUpstash.generateKey("contents", "list", content.userId, "*");
    await Promise.all([
      CacheServiceUpstash.del(detailCacheKey),
      CacheServiceUpstash.delByPattern(listCachePattern),
    ]);

    // Regenerate suggestions via Event
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
      // Invalidate Caches
      const detailCacheKey = CacheServiceUpstash.generateKey("contents", "detail", id);
      const listCachePattern = CacheServiceUpstash.generateKey("contents", "list", userId, "*");
      await Promise.all([
        CacheServiceUpstash.del(detailCacheKey),
        CacheServiceUpstash.delByPattern(listCachePattern),
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
