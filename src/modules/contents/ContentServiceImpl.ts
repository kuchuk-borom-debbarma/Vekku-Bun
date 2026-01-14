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
import { getTagSuggestionService } from "../suggestions";

const SEGMENT_SIZE = 20;

export class ContentServiceImpl implements IContentService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async createContent(data: {
    title: string;
    content: string;
    contentType: ContentType;
    userId: string;
  }): Promise<Content | null> {
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

    // Trigger Suggestion Generation (Fire and forget or await?)
    // Awaiting ensures consistency for the user's immediate view.
    try {
      const suggestionService = getTagSuggestionService();
      const threshold = process.env.EMBEDDING_THRESHOLD ? parseFloat(process.env.EMBEDDING_THRESHOLD) : 0.4;
      const matchCount = process.env.EMBEDDING_MATCH_COUNT ? parseInt(process.env.EMBEDDING_MATCH_COUNT) : 20;
      
      await suggestionService.createSuggestionsForContent({
        content: content.body,
        contentId: content.id,
        userId: content.userId,
        suggestionsCount: matchCount,
        threshold: threshold,
      });
    } catch (e) {
      console.error("Failed to generate suggestions for content:", e);
    }

    return {
      id: content.id,
      title: content.title,
      body: content.body,
      userId: content.userId,
      contentType: content.contentType as ContentType,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      deletedAt: content.deletedAt,
      isDeleted: content.isDeleted,
    };
  }

  async updateContent(data: {
    id: string;
    userId: string;
    title?: string;
    content?: string;
    contentType?: ContentType;
  }): Promise<Content | null> {
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
          eq(schema.contents.isDeleted, false),
        ),
      )
      .returning();

    const content = result[0];
    if (!content) return null;

    // Regenerate suggestions if content body changed
    if (data.content) {
         try {
            const suggestionService = getTagSuggestionService();
            const threshold = process.env.EMBEDDING_THRESHOLD ? parseFloat(process.env.EMBEDDING_THRESHOLD) : 0.4;
            const matchCount = process.env.EMBEDDING_MATCH_COUNT ? parseInt(process.env.EMBEDDING_MATCH_COUNT) : 20;

            await suggestionService.createSuggestionsForContent({
                content: content.body,
                contentId: content.id,
                userId: content.userId,
                suggestionsCount: matchCount,
                threshold: threshold,
            });
         } catch (e) {
             console.error("Failed to regenerate suggestions on update:", e);
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
      deletedAt: content.deletedAt,
      isDeleted: content.isDeleted,
    };
  }

  async deleteContent(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(schema.contents)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(
        and(
          eq(schema.contents.id, id),
          eq(schema.contents.userId, userId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  async getContentById(id: string): Promise<Content | null> {
    const result = await this.db
      .select()
      .from(schema.contents)
      .where(
        and(eq(schema.contents.id, id), eq(schema.contents.isDeleted, false)),
      )
      .limit(1);

    const content = result[0];
    if (!content) return null;

    return {
      id: content.id,
      title: content.title,
      body: content.body,
      userId: content.userId,
      contentType: content.contentType as ContentType,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      deletedAt: content.deletedAt,
      isDeleted: content.isDeleted,
    };
  }

  async getContentsByUserId(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    chunkId?: string,
  ): Promise<ChunkPaginationData<Content>> {
    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    let whereClause = and(
      eq(schema.contents.userId, userId),
      eq(schema.contents.isDeleted, false),
    );

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
          eq(schema.contents.isDeleted, false),
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
          deletedAt: content.deletedAt,
          isDeleted: content.isDeleted,
        }));
    }

    return {
      data: pageData,
      metadata: {
        nextChunkId,
        chunkSize: SEGMENT_SIZE,
        chunkTotalItems,
        limit,
        offset,
      },
    };
  }
}
