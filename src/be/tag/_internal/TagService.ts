import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../infra/Drizzle";
import {
  PaginationDirection,
  type AnchorSegmentPaginationData,
} from "../../util/Pagination";
import { ITagService, type UserTag } from "../api";
import { userTags } from "./entities/UserTagEntity";
import { generateUUID } from "../../util/UUID";

export class TagService extends ITagService {
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

  override updateTag(data: {
    id: string;
    userId: string;
    name?: string;
    semantic?: string;
  }): Promise<UserTag> {
    throw new Error("Method not implemented.");
  }
  override deleteTag(data: { id: string; userId: string }): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  override async getTagsOfUser(data: {
    userId: string;
    anchorId?: string;
    limit?: number;
    offset?: number;
    direction?: PaginationDirection;
  }): Promise<AnchorSegmentPaginationData<UserTag>> {
    let {
      userId,
      anchorId = null,
      direction = PaginationDirection.NEXT,
      limit = 5,
      offset = 0,
    } = data;

    if (limit + offset > this.SEGMENT_SIZE) {
      throw new Error(
        `Limit and Offset exceed segment boundary. Max limit + offset allowed is ${this.SEGMENT_SIZE}. Requested: ${
          limit + offset
        }`,
      );
    }

    let whereClause = eq(userTags.userId, userId);
    
    // Sort Order depends on Direction
    // NEXT: Newest -> Oldest (DESC)
    // PREVIOUS: Oldest -> Newest (ASC) - Going back up the timeline
    const sortOrder = direction === PaginationDirection.NEXT 
      ? [desc(userTags.createdAt), desc(userTags.id)]
      : [asc(userTags.createdAt), asc(userTags.id)];

    if (anchorId) {
      const [anchorTag] = await db
        .select({ createdAt: userTags.createdAt })
        .from(userTags)
        .where(and(eq(userTags.id, anchorId), eq(userTags.userId, userId)))
        .limit(1);

      if (anchorTag) {
        if (direction === PaginationDirection.NEXT) {
           // Going DOWN: (date, id) <= (anchorDate, anchorId)
           whereClause = and(
             eq(userTags.userId, userId),
             sql`(${userTags.createdAt}, ${userTags.id}) <= (${anchorTag.createdAt}, ${anchorId})`
           )!;
        } else {
           // Going UP: (date, id) > (anchorDate, anchorId)
           // Strictly greater because we want the segment BEFORE this anchor
           whereClause = and(
             eq(userTags.userId, userId),
             sql`(${userTags.createdAt}, ${userTags.id}) > (${anchorTag.createdAt}, ${anchorId})`
           )!;
        }
      }
    }

    const [segmentIds, result] = await Promise.all([
      db
        .select({ id: userTags.id })
        .from(userTags)
        .where(whereClause)
        .orderBy(...sortOrder)
        .limit(this.SEGMENT_SIZE + 1),
      db
        .select()
        .from(userTags)
        .where(whereClause)
        .orderBy(...sortOrder)
        .limit(limit)
        .offset(offset),
    ]);

    // Analyze Segment
    const totalFound = segmentIds.length;
    const hasNextSegment = totalFound > this.SEGMENT_SIZE;
    const segmentItemCount = hasNextSegment ? this.SEGMENT_SIZE : totalFound;
    
    // Calculate Next/Prev Anchor
    const nextAnchorId = hasNextSegment ? segmentIds[this.SEGMENT_SIZE]!.id : null;
    
    // Current Anchor:
    // If we have data, the first item is effectively the start of this segment view.
    // If anchorId was null (start), this is the newest item.
    const currentAnchorId = segmentIds.length > 0 ? segmentIds[0]!.id : (anchorId || "");

    const response: UserTag[] = result.map((tag) => ({
      id: tag.id,
      name: tag.name,
      semantic: tag.semantic,
      userId: tag.userId,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }));

    return {
      data: response,
      metadata: {
        currentAnchorId,
        nextAnchorId,
        segmentSize: this.SEGMENT_SIZE,
        segmentItemCount,
        hasNextSegment,
        requestedDirection: direction,
        requestedLimit: limit,
        requestedOffset: offset,
      },
    };
  }
}
