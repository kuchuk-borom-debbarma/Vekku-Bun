import { Hono } from "hono";
import { getContentTagSuggestionService } from "./index";
import { getTagService } from "../tags";
import { getContentService } from "../contents";
import { verifyJwt } from "../../lib/jwt";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: {
    id: string;
    role: string;
  };
  session: any;
};

const suggestionRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all suggestion routes
suggestionRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized: Missing Authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) {
    return c.json({ error: "Unauthorized: Malformed token" }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }

  c.set("user", {
    id: payload.sub as string,
    role: payload.role as string,
  });
  await next();
});

// GET Suggestions for Content
suggestionRouter.get("/content/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();

  const result = await suggestionService.getSuggestionsForContent(contentId, user.id);
  return c.json(result);
});

// POST Regenerate Suggestions for Content
suggestionRouter.post("/content/:id/regenerate", async (c) => {
  const contentId = c.req.param("id");
  const user = c.get("user");
  
  const contentService = getContentService();
  const suggestionService = getContentTagSuggestionService();

  const content = await contentService.getContentById(contentId);
  if (!content) {
    return c.json({ error: "Content not found" }, 404);
  }

  if (content.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Trigger suggestion generation
  await suggestionService.createSuggestionsForContent({
    content: content.body,
    contentId: content.id,
    userId: user.id,
    suggestionsCount: 20, // Default count
  });

  const updatedSuggestions = await suggestionService.getSuggestionsForContent(contentId, user.id);
  return c.json({ message: "Suggestions regenerated", data: updatedSuggestions });
});

// POST Relearn Tags (Generate Embeddings)
suggestionRouter.post("/tags/relearn", async (c) => {
  const { tagIds } = await c.req.json();
  const user = c.get("user");

  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return c.json({ error: "Invalid tagIds array" }, 400);
  }

  const tagService = getTagService();
  const suggestionService = getContentTagSuggestionService();

  // Fetch tags to get semantic string
  const tags = await tagService.getTagsByIds(tagIds, user.id);
  
  if (tags.length === 0) {
    return c.json({ message: "No matching tags found to relearn" });
  }

  // Process sequentially or parallel? Parallel is faster.
  const results = await Promise.allSettled(
    tags.map(async (tag) => {
        await suggestionService.learnTag(tag.semantic);
        return tag.id;
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return c.json({ 
    message: `Relearning complete. Success: ${succeeded}, Failed: ${failed}`,
    processedTags: tags.map(t => t.id)
  });
});

export { suggestionRouter };