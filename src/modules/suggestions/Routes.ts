import { Hono } from "hono";
import { getContentTagSuggestionService } from "./index";
import { getTagService } from "../tags";
import { getContentService } from "../contents";
import { verifyJwt } from "../../lib/jwt";
import { getAiRatelimit } from "../../middleware/rateLimiter";

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

// GET Suggestions for Content (Cached Only)
suggestionRouter.get("/content/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const mode = (c.req.query("mode") as "tags" | "keywords" | "both") || "both";
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();

  const result = await suggestionService.getSuggestionsForContent(contentId, user.id, mode);
  if (!result) return c.json({ existing: [], potential: [] });
  return c.json(result);
});

/**
 * Unified Suggestion Generation (Cache-First)
 */
suggestionRouter.post("/generate", async (c) => {
  const { contentId, text, mode = "both" } = await c.req.json();
  const user = c.get("user");
  const suggestionService = getContentTagSuggestionService();
  const contentService = getContentService();

  // 1. Resolve Content Body
  let body = text;
  if (contentId && !body) {
    const content = await contentService.getContentById(contentId);
    if (!content) return c.json({ error: "Content not found" }, 404);
    if (content.userId !== user.id) return c.json({ error: "Unauthorized" }, 401);
    body = content.body;
  }

  if (!body) return c.json({ error: "Text or Content ID is required" }, 400);

  // 2. Check CACHE first (always by Text Hash now for unified hits)
  const cached = await suggestionService.getSuggestionsForContent(contentId, user.id, mode, body);
  if (cached) {
    console.log(`[Suggestions] Cache HIT for ${mode} (Anchor: TextHash)`);
    return c.json(cached);
  }

  // 3. Cache Miss -> Enforce AI Rate Limit (Independent per mode)
  const limiter = getAiRatelimit();
  if (limiter) {
    // Unique identifier per user + mode ensures separate 3/min limits
    const identifier = `${user.id}:${mode}`;
    const { success } = await limiter.limit(identifier);
    if (!success) {
      return c.json({ error: `AI rate limit exceeded for ${mode}. Please wait a minute.` }, 429);
    } 
  }

  // 4. Generate & Cache
  const result = await suggestionService.createSuggestionsForContent({
    content: body,
    contentId,
    userId: user.id,
    suggestionsCount: 15,
    mode,
  });

  return c.json(result);
});

// Extract Keywords (KeyBERT)
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