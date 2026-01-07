import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../infra/Drizzle";
import { type ChunkPaginationData } from "../../util/Pagination";
import { generateUUID } from "../../util/UUID";
import { ITagService, type UserTag } from "../api";
import { userTags } from "./entities/UserTagEntity";

export class TagServiceImpl extends ITagService {
  SEGMENT_SIZE = 2000;
  override async createTag(data: {
    name: string;
    semantic: string;
    userId: string;
  }): Promise<UserTag | null> {
    const result = await db
      .insert(userTags)
      .values([
        {
          name: data.name,
          semantic: data.semantic,
          userId: data.userId,
          id: generateUUID([data.name, data.userId]),
        },
      ])
      .onConflictDoUpdate({
        target: userTags.id,
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
      };
    } else {
      return null;
    }
  }

  override async updateTag(data: {
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

    const result = await db
      .update(userTags)
      .set({ ...toUpdate, updatedAt: new Date() })
      .where(
        and(
          eq(userTags.id, data.id),
          eq(userTags.userId, data.userId),
          eq(userTags.isDeleted, false),
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
      };
    }
    return null;
  }

  override async deleteTag(data: {
    id: string;
    userId: string;
  }): Promise<boolean> {
    const result = await db
      .update(userTags)
      .set({ updatedAt: new Date(), isDeleted: true })
      .where(and(eq(userTags.id, data.id), eq(userTags.userId, data.userId)))
      .returning();

    return result.length > 0;
  }

  override async getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>> {
    const { userId, chunkId = null, limit = 20, offset = 0 } = data;

    if (offset < 0) throw new Error("Offset cannot be negative.");
    if (limit < 1) throw new Error("Limit must be at least 1.");
    if (offset >= this.SEGMENT_SIZE) {
      throw new Error(
        `Offset (${offset}) cannot equal or exceed chunk size (${this.SEGMENT_SIZE}).`,
      );
    }

    // 1. Resolve Cursor (Timestamp lookup if chunkId is provided)
    let whereClause = and(
      eq(userTags.userId, userId),
      eq(userTags.isDeleted, false),
    );

    if (chunkId) {
      const [cursorTag] = await db
        .select({ createdAt: userTags.createdAt })
        .from(userTags)
        .where(and(eq(userTags.id, chunkId), eq(userTags.userId, userId)))
        .limit(1);

      if (cursorTag) {
        // Cursor Logic: Fetch items newer/older than this cursor.
        // Default sort is Newest -> Oldest (DESC).
        // So we want items <= cursorTimestamp
        // If timestamps match, we use ID to break tie (lexicographical check)
        whereClause = and(
          eq(userTags.userId, userId),
          eq(userTags.isDeleted, false),
          sql`(${userTags.createdAt}, ${userTags.id}) <= (${cursorTag.createdAt}, ${chunkId})`,
        )!;
      }
    }

    // 2. Fetch Chunk IDs (The "Map")
    // Fetch one extra item to determine if there is a next chunk
    const chunkIds = await db
      .select({ id: userTags.id })
      .from(userTags)
      .where(whereClause)
      .orderBy(desc(userTags.createdAt), desc(userTags.id))
      .limit(this.SEGMENT_SIZE + 1);

    // 3. Calculate Metadata
    const totalFound = chunkIds.length;
    const hasNextChunk = totalFound > this.SEGMENT_SIZE;
    const chunkTotalItems = hasNextChunk ? this.SEGMENT_SIZE : totalFound;

    // The start of the NEXT chunk is the (SEGMENT_SIZE + 1)th item
    const nextChunkId = hasNextChunk
      ? chunkIds[this.SEGMENT_SIZE]!.id
      : null;

    // 4. Determine Page IDs (In-Memory Slice)
    // We only need the IDs for the requested page
    const pageIds = chunkIds
      .slice(offset, offset + limit)
      .map((row: { id: string }) => row.id);

    // 5. Fetch Full Data (if any IDs found)
    let pageData: UserTag[] = [];
    if (pageIds.length > 0) {
      const rows = await db
        .select()
        .from(userTags)
        .where(inArray(userTags.id, pageIds));

      // Re-sort in memory because 'IN' clause does not guarantee order
      // We want them in the same order as 'pageIds' (which came from the sorted chunk)
      const idMap = new Map(rows.map((r: typeof rows[number]) => [r.id, r]));
      pageData = pageIds
        .map((id: string) => idMap.get(id)!)
        .filter((item: typeof rows[number] | undefined) => item !== undefined) // Safety check
        .map((tag: typeof rows[number]) => ({
          id: tag.id,
          name: tag.name,
          semantic: tag.semantic,
          userId: tag.userId,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        }));
    }

    return {
      data: pageData,
      metadata: {
        nextChunkId,
        chunkSize: this.SEGMENT_SIZE,
        chunkTotalItems,
        limit,
        offset,
      },
    };
  }
}
