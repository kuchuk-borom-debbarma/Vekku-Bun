import { ITagService } from "./api";
import { TagService } from "./_internal/TagService";
import { createTagRouter } from "./_internal/routes";

export const tagService: ITagService = new TagService();
export const tagRouter = createTagRouter(tagService);
export * from "./api";
