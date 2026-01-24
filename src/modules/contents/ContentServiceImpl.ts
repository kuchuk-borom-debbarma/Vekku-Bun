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

  async createYoutubeContent(data: {
    url: string;
    userId: string;
    userTitle?: string;
    userDescription?: string;
    transcript?: string;
    tagIds?: string[];
  }): Promise<Content | null> {
    // We trust the frontend to send the transcript and title
    const title = data.userTitle || "YouTube Video";
    const body = `${title}\n\n${data.userDescription || ""}\n\n${data.transcript || ""}`;

    const metadata = {
        youtubeUrl: data.url,
        userDescription: data.userDescription,
        transcript: data.transcript,
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

    const detailCacheKey = CacheServiceUpstash.generateKey("contents", "detail", content.id);
    const listCachePattern = CacheServiceUpstash.generateKey("contents", "list", content.userId, "*");
    await Promise.all([
      CacheServiceUpstash.del(detailCacheKey),
      CacheServiceUpstash.delByPattern(listCachePattern),
    ]);

    if (data.content) {
      try {
        const eventBus = getEventBus();
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
      .where(and(eq(schema.contents.id, id), eq(schema.contents.userId, userId)))
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

      const detailCacheKey = CacheServiceUpstash.generateKey("contents", "detail", id);
      const listCachePattern = CacheServiceUpstash.generateKey("contents", "list", userId, "*");
      await Promise.all([
        CacheServiceUpstash.del(detailCacheKey),
        CacheServiceUpstash.delByPattern(listCachePattern),
      ]);

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
    const cacheKey = CacheServiceUpstash.generateKey("contents", "list", userId, chunkId, limit, offset);
    const cached = await CacheServiceUpstash.get<ChunkPaginationData<Content>>(cacheKey);
    if (cached) return cached;

    let whereClause = eq(schema.contents.userId, userId);
    // ... pagination logic ... (keeping it simple for now)
    const rows = await this.db.select().from(schema.contents).where(whereClause).limit(limit).offset(offset);
    
    const result = {
      data: rows.map(content => ({
        id: content.id,
        title: content.title,
        body: content.body,
        userId: content.userId,
        contentType: content.contentType as ContentType,
        metadata: content.metadata,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
      })),
      metadata: {
        nextChunkId: null,
        chunkSize: limit,
        chunkTotalItems: rows.length,
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
  ): Promise<ChunkPaginationData<Content>> {
    // ... logic ...
    return { data: [], metadata: { nextChunkId: null, chunkSize: limit, chunkTotalItems: 0, limit, offset } };
  }
}
