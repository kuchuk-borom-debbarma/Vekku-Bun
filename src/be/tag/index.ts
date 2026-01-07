import { ITagService } from "./api";
import { TagServiceImpl } from "./_internal/TagServiceImpl";
import { createTagRouter } from "./_internal/routes";

export const tagService: ITagService = new TagServiceImpl();
export const tagRouter = createTagRouter(tagService);
export * from "./api";
