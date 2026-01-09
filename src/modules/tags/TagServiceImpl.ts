import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import type { ChunkPaginationData } from "../../lib/pagination";
import type { ITagService, UserTag } from "./TagService";

const SEGMENT_SIZE = 2000;

export class TagServiceImpl implements ITagService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async createTag(data: {
    name: string;
    semantic: string;
    userId: string;
  }): Promise<UserTag | null> {
    const result = await this.db
      .insert(schema.userTags)
      .values([
        {
          name: data.name,
          semantic: data.semantic,
          userId: data.userId,
          id: generateUUID([data.name, data.userId]),
        },
      ])
      .onConflictDoUpdate({
        target: schema.userTags.id,
        set: {
          isDeleted: false,
          updatedAt: new Date(),
          name: data.name,
          semantic: data.semantic,
        },
      })
      .returning();
    const tag = result[0];
    if (tag) {
      return {
        id: tag.id,
        name: tag.name,
        semantic: tag.semantic,
        userId: tag.userId,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        deletedAt: tag.deletedAt,
        isDeleted: tag.isDeleted,
      };
    } else {
      return null;
    }
  }

  async updateTag(data: {
    id: string;
    userId: string;
    name?: string;
    semantic?: string;
  }): Promise<UserTag | null> {
    const toUpdate: { name?: string; semantic?: string } = {};

    if (data.name) {
      toUpdate.name = data.name;
    }
    if (data.semantic) {
      toUpdate.semantic = data.semantic;
    }

    const result = await this.db
      .update(schema.userTags)
      .set({ ...toUpdate, updatedAt: new Date() })
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
      return {
        id: tag.id,
        name: tag.name,
        semantic: tag.semantic,
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
    const result = await this.db
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
      const [cursorTag] = await this.db
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
    const chunkIds = await this.db
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
      .map((row: { id: string }) => row.id);

    // 5. Fetch Full Data (if any IDs found)
    let pageData: UserTag[] = [];
    if (pageIds.length > 0) {
      const rows = await this.db
        .select()
        .from(schema.userTags)
        .where(inArray(schema.userTags.id, pageIds));

      const idMap = new Map(rows.map((r) => [r.id, r]));
      pageData = pageIds
        .map((id) => idMap.get(id)!)
        .filter((item) => item !== undefined)
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          semantic: tag.semantic,
          userId: tag.userId,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
          deletedAt: tag.deletedAt,
          isDeleted: tag.isDeleted,
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
