import { asClass, type AwilixContainer } from "awilix";
import { TagServiceImpl } from "./_internal/TagServiceImpl";
import { TagController } from "./_internal/TagController";

// Public API
export * from "./api";

// Registration Function
export const registerTagDomain = (container: AwilixContainer) => {
  container.register({
    tagService: asClass(TagServiceImpl).singleton(),
    tagController: asClass(TagController).singleton(),
  });
};
