import type { ChunkPaginationData } from "../../lib/pagination";

export type UserTag = {
  id: string;
  name: string;
  semantic: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
};

export interface ITagService {
  createTag(
    data: {
      name: string;
      semantic: string;
      userId: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<UserTag | null>;

  updateTag(
    data: {
      id: string;
      userId: string;
      name?: string;
      semantic?: string;
    },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<UserTag | null>;

  deleteTag(
    data: { id: string; userId: string },
    ctx?: { waitUntil: (promise: Promise<any>) => void },
  ): Promise<boolean>;

  getTagsOfUser(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<UserTag>>;

  getTagsByIds(tagIds: string[], userId: string): Promise<UserTag[]>;
}
