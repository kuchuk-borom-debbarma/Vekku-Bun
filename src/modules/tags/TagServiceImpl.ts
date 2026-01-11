import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import type { ChunkPaginationData } from "../../lib/pagination";
import type { ITagService, UserTag } from "./TagService";
import { getDb } from "../../db";
import { getTagSuggestionService } from "../suggestions";

const SEGMENT_SIZE = 2000;

export class TagServiceImpl implements ITagService {
  async createTag(data: {
    name: string;
    semantic: string;
    userId: string;
  }): Promise<UserTag | null> {
    const db = getDb();
    const suggestionService = getTagSuggestionService();

    // 1. Learn the tag (Get/Create Concept ID)
    const embeddingId = await suggestionService.learnTag(data.semantic);

    // 2. Create User Tag Link
    const tagId = generateUUID([data.name, data.userId]);
    
    const result = await db
      .insert(schema.userTags)
      .values({
        id: tagId,
        userId: data.userId,
        name: data.name,
        embeddingId: embeddingId,
      })
      .onConflictDoUpdate({
        target: schema.userTags.id,
        set: {
          isDeleted: false,
          updatedAt: new Date(),
          name: data.name,
          embeddingId: embeddingId,
        },
      })
      .returning();

    const tag = result[0];
    if (tag) {
      return {
        id: tag.id,
        name: tag.name,
        semantic: data.semantic,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        deletedAt: tag.deletedAt,
        isDeleted: tag.isDeleted,
      };
    }
    return null;
  }

  async updateTag(data: {
    id: string;
    userId: string;
    name?: string;
    semantic?: string;
  }): Promise<UserTag | null> {
    const db = getDb();
    
    let newEmbeddingId: string | undefined;

    if (data.semantic) {
      const suggestionService = getTagSuggestionService();
      newEmbeddingId = await suggestionService.learnTag(data.semantic);
    }

    const toUpdate: { name?: string; embeddingId?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (data.name) toUpdate.name = data.name;
    if (newEmbeddingId) toUpdate.embeddingId = newEmbeddingId;

    const result = await db
      .update(schema.userTags)
      .set(toUpdate)
      .where(
        and(
          eq(schema.userTags.id, data.id),
          eq(schema.userTags.userId, data.userId),
          eq(schema.userTags.isDeleted, false),
        ),
      )
      .returning();

    const tag = result[0];
    if (tag) {
       let finalSemantic = data.semantic;
       if (!finalSemantic) {
          const concept = await db.select({ semantic: schema.tagEmbeddings.semantic })
            .from(schema.tagEmbeddings)
            .where(eq(schema.tagEmbeddings.id, tag.embeddingId))
            .limit(1);
          finalSemantic = concept[0]?.semantic || "";
       }

      return {
        id: tag.id,
        name: tag.name,
        semantic: finalSemantic!,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        deletedAt: tag.deletedAt,
        isDeleted: tag.isDeleted,
      };
    }
    return null;
  }

  async deleteTag(data: { id: string; userId: string }): Promise<boolean> {
    const db = getDb();
    const result = await db
      .update(schema.userTags)
      .set({ updatedAt: new Date(), isDeleted: true })
      .where(
        and(
          eq(schema.userTags.id, data.id),
          eq(schema.userTags.userId, data.userId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  async getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>> {
    const { userId, chunkId = null, limit = 20, offset = 0 } = data;
    const db = getDb();
    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${SEGMENT_SIZE}).`,
      );
    }

    // 1. Resolve Cursor (Timestamp lookup if chunkId is provided)
    let whereClause = and(
      eq(schema.userTags.userId, userId),
      eq(schema.userTags.isDeleted, false),
    );

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
          eq(schema.userTags.isDeleted, false),
          sql`(${schema.userTags.createdAt}, ${schema.userTags.id}) <= (${cursorTag.createdAt}, ${chunkId})`,
        )!;
      }
    }

    // 2. Fetch Chunk IDs (The "Map")
    const chunkIds = await db
      .select({ id: schema.userTags.id })
      .from(schema.userTags)
      .where(whereClause)
      .orderBy(desc(schema.userTags.createdAt), desc(schema.userTags.id))
      .limit(SEGMENT_SIZE + 1);

    // 3. Calculate Metadata
    const totalFound = chunkIds.length;
    const hasNextChunk = totalFound > SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? SEGMENT_SIZE : totalFound;
    const nextChunkId = hasNextChunk ? chunkIds[SEGMENT_SIZE]!.id : null;

    // 4. Determine Page IDs (In-Memory Slice)
    const pageIds = chunkIds
      .slice(offset, offset + limit)
      .map((row) => row.id);

    // 5. Fetch Full Data with JOIN
    let pageData: UserTag[] = [];
    if (pageIds.length > 0) {
      const rows = await db
        .select({
            tag: schema.userTags,
            embedding: schema.tagEmbeddings
        })
        .from(schema.userTags)
        .leftJoin(schema.tagEmbeddings, eq(schema.userTags.embeddingId, schema.tagEmbeddings.id))
        .where(inArray(schema.userTags.id, pageIds));

      const idMap = new Map(rows.map((r) => [r.tag.id, r]));
      
      pageData = pageIds
        .map((id) => idMap.get(id))
        .filter((item) => item !== undefined)
        .map((row) => ({
          id: row!.tag.id,
          name: row!.tag.name,
          semantic: row!.embedding?.semantic || "",
          userId: row!.tag.userId,
          createdAt: row!.tag.createdAt,
          updatedAt: row!.tag.updatedAt,
          deletedAt: row!.tag.deletedAt,
          isDeleted: row!.tag.isDeleted,
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
