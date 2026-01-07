import { asClass, type AwilixContainer } from "awilix";
import { Hono } from "hono";
import { TagServiceImpl } from "./_internal/TagServiceImpl";
import { registerTagRoutes } from "./_internal/routes";
import { ITagService } from "./api";

// Public API
export * from "./api";

// Registration Function (Services)
export const registerTagDomain = (container: AwilixContainer) => {
  container.register({
    tagService: asClass(TagServiceImpl).singleton(),
  });
};

// Mounting Function (Routes)
export const mountTagRoutes = (router: Hono, container: AwilixContainer) => {
  const tagService = container.resolve<ITagService>("tagService");
  registerTagRoutes(router, tagService);
};