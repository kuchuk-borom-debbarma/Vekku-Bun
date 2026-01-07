import { ITagService } from "./api";
import { TagService } from "./_internal/TagService";

export const tagService: ITagService = new TagService();
export * from "./api";
