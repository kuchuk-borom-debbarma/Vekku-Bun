import { Hono } from "hono";
import { getContentTagSuggestionService } from "./index";
import { getContentService } from "../contents";
import { verifyJwt } from "../../lib/jwt";
import { getSuggestionRatelimit } from "../../middleware/rateLimiter";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: {
    id: string;
    role: string;
  };
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

// GET Suggestions (Cached in DB or Auto-Generated)
suggestionRouter.get("/content/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();
  const contentService = getContentService();

  // Check ownership
  const content = await contentService.getContentById(contentId);
  if (!content) return c.json({ error: "Content not found" }, 404);
  if (content.userId !== user.id) return c.json({ error: "Unauthorized" }, 401);

  try {
    const result = await suggestionService.getSuggestionsForContent(contentId, user.id);
    return c.json(result);
  } catch (err) {
    console.error("[SuggestionAPI] Error getting suggestions:", err);
    return c.json({ error: "Failed to get suggestions" }, 500);
  }
});

// POST Regenerate Suggestions (Force AI)
suggestionRouter.post("/content/:contentId/regenerate", async (c) => {
  const contentId = c.req.param("contentId");
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();
  const contentService = getContentService();

  // Check ownership
  const content = await contentService.getContentById(contentId);
  if (!content) return c.json({ error: "Content not found" }, 404);
  if (content.userId !== user.id) return c.json({ error: "Unauthorized" }, 401);

  // Rate Limit: 5 per minute
  const limiter = getSuggestionRatelimit();
  if (limiter) {
    const { success, limit, reset, remaining } = await limiter.limit(user.id);
    
    c.header("X-RateLimit-Limit", limit.toString());
    c.header("X-RateLimit-Remaining", remaining.toString());
    c.header("X-RateLimit-Reset", reset.toString());

    if (!success) {
        return c.json({ error: "Too many regeneration requests. Please wait." }, 429);
    }
  }

  try {
    const result = await suggestionService.regenerateSuggestionsForContent(contentId, user.id);
    return c.json(result);
  } catch (err) {
    console.error("[SuggestionAPI] Error regenerating suggestions:", err);
    return c.json({ error: "Failed to regenerate suggestions" }, 500);
  }
});

// Analyze Text (Stateless - for drafts)
suggestionRouter.post("/analyze", async (c) => {
  const { text } = await c.req.json();
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();

  if (!text) return c.json({ error: "Text is required" }, 400);

  // Rate Limit (AI) - Shared with suggestions
  const limiter = getSuggestionRatelimit();
  if (limiter) {
     const { success, limit, reset, remaining } = await limiter.limit(user.id);
     c.header("X-RateLimit-Limit", limit.toString());
     c.header("X-RateLimit-Remaining", remaining.toString());
     c.header("X-RateLimit-Reset", reset.toString());

     if (!success) return c.json({ error: "Rate limit exceeded" }, 429);
  }

  try {
    const result = await suggestionService.generateSuggestionsForText(text, user.id);
    return c.json(result);
  } catch (err) {
    console.error("[SuggestionAPI] Error analyzing text:", err);
    return c.json({ error: "Failed to analyze text" }, 500);
  }
});

// Extract Keywords (Stateless - simple list)
suggestionRouter.post("/extract", async (c) => {
  const { text } = await c.req.json();
  if (!text) return c.json({ error: "Text is required" }, 400);

  const suggestionService = getContentTagSuggestionService();
  
  try {
    const keywords = await suggestionService.extractKeywords(text);
    return c.json({ keywords });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export { suggestionRouter };