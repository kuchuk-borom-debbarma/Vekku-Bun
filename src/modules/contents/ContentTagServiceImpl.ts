import type { ChunkPaginationData } from "../../lib/pagination";
import type { ContentTag, IContentTagService } from "./ContentTagService";

export class ContentTagServiceImpl implements IContentTagService {
  addTagsToContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  removeTagsFromContent(data: {
    tagIds: string[];
    contentId: string;
    userId: string;
  }): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getTagOfContent(data: {
    contentId: string;
    userId: string;
    tagId: string;
  }): Promise<ContentTag | null> {
    throw new Error("Method not implemented.");
  }
  getTagsOfContent(data: {
    userId: string;
    chunkId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChunkPaginationData<ContentTag>> {
    throw new Error("Method not implemented.");
  }
}
