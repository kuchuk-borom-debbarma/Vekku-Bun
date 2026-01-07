import { asClass, asFunction, type AwilixContainer } from "awilix";
import { TagServiceImpl } from "./_internal/TagServiceImpl";
import { createTagRouter } from "./_internal/routes";
import { ITagService } from "./api";

// Public API
export * from "./api";

// Registration Function
export const registerTagDomain = (container: AwilixContainer) => {
  container.register({
    tagService: asClass(TagServiceImpl).singleton(),
    tagRouter: asFunction(({ tagService }) => 
      createTagRouter(tagService as ITagService)
    ).singleton(),
  });
};
