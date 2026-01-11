import { Hono } from "hono";
import { getTagSuggestionService } from "./index";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: any;
  session: any;
};

const suggestionRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all suggestion routes
suggestionRouter.use("*", async (c, next) => {
  if (!c.get("user")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

suggestionRouter.get("/content/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const suggestionService = getTagSuggestionService();

  const result = await suggestionService.getSuggestionsForContent(contentId);
  return c.json(result);
});

export { suggestionRouter };
