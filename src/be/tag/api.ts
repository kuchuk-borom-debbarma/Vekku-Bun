import type {
  AnchorSegmentPaginationData,
  PaginationDirection,
} from "../util/Pagination";
import { TagService } from "./_internal/TagService";

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
  }): Promise<UserTag>;

  abstract deleteTag(data: { id: string; userId: string }): Promise<boolean>;

  abstract getTagsOfUser(data: {
    userId: string;
    anchorId?: string;
    limit?: number;
    offset?: number;
    direction?: PaginationDirection;
  }): Promise<AnchorSegmentPaginationData<UserTag>>;
}

export const tagService: ITagService = new TagService();
