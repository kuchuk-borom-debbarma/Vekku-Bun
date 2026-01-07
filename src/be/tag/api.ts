import type { ChunkPaginationData } from "../util/Pagination";

export type UserTag = {
  id: string;
  name: string;
  semantic: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export abstract class ITagService {
  abstract createTag(data: {
    name: string;
    semantic: string;
    userId: string;
  }): Promise<UserTag | null>;

  abstract updateTag(data: {
    id: string;
    userId: string;
    name?: string;
    semantic?: string;
  }): Promise<UserTag | null>;

  abstract deleteTag(data: { id: string; userId: string }): Promise<boolean>;

  abstract getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>>;
}
