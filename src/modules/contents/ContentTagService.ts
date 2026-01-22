import type { ChunkPaginationData } from "../../lib/pagination";

export type ContentTag = {
  id: string;
  contentId: string;
  tagId: string;
  createdAt: Date;
  name: string;
  semantic: string;
};

export interface IContentTagService {
  /**
   * add tags to the content. Will be ignored if the tags are already present
   */
  addTagsToContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean>;

  /**
   * remove tags from content. Will be ignored if tags are not linked to content already.
   */
  removeTagsFromContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean>;

  /**
   * get specific tag of a content. If not present will return null
   */
  getTagOfContent(data: {
    contentId: string;
    userId: string;
    tagId: string;
  }): Promise<ContentTag | null>;

  /**
   * Get tags of content with pagination
   */
  getTagsOfContent(data: {
    contentId: string;
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<ContentTag>>;
}
