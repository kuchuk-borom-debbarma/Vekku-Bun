import type { ChunkPaginationData } from "../util/Pagination";

export type UserTag = {
  id: string;
  name: string;
  semantic: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export interface ITagService {
  createTag(data: {
    name: string;
    semantic: string;
    userId: string;
  }): Promise<UserTag | null>;

  updateTag(data: {
    id: string;
    userId: string;
    name?: string;
    semantic?: string;
  }): Promise<UserTag | null>;

  deleteTag(data: { id: string; userId: string }): Promise<boolean>;

  getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>>;
}
