import { Hono } from "hono";
import { getContentService, getContentTagService } from "./index";
import { verifyJwt } from "../../lib/jwt";
import { ContentType } from "./ContentService";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: {
    id: string;
    role: string;
  };
};

const contentRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all content routes
contentRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized: Missing Authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
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

// Create YouTube Content
contentRouter.post("/youtube", async (c) => {
  const data = await c.req.json();
  const user = c.get("user");
  const contentService = getContentService();

  if (!data.url) {
    return c.json({ error: "URL is required" }, 400);
  }

  try {
    const result = await contentService.createYoutubeContent({
      url: data.url,
      userId: user.id,
      userTitle: data.title, 
      userDescription: data.description, 
      transcript: data.transcript,
      tagIds: data.tagIds
    });

    if (result && data.tagIds && Array.isArray(data.tagIds) && data.tagIds.length > 0) {
       const contentTagService = getContentTagService();
       try {
         await contentTagService.addTagsToContent({
           contentId: result.id,
           tagIds: data.tagIds,
           userId: user.id,
         });
       } catch (tagError) {
         console.error("Failed to link tags:", tagError);
       }
    }

    return c.json(result, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Create Content
contentRouter.post("/", async (c) => {
  const data = await c.req.json();
  const user = c.get("user");
  const contentService = getContentService();

  try {
    const result = await contentService.createTextContent(
      {
        title: data.title,
        content: data.content,
        contentType: data.contentType || ContentType.PLAIN_TEXT,
        userId: user.id,
      },
      c.executionCtx,
    );

    if (result && data.tagIds && Array.isArray(data.tagIds) && data.tagIds.length > 0) {
      const contentTagService = getContentTagService();
      try {
        await contentTagService.addTagsToContent({
          contentId: result.id,
          tagIds: data.tagIds,
          userId: user.id,
        });
      } catch (tagError) {
        console.error("Failed to link tags:", tagError);
      }
    }

    return c.json(result, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Get Contents by Tags
contentRouter.get("/by-tags", async (c) => {
  const user = c.get("user");
  const tagIdsStr = c.req.query("tagIds");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

  if (!tagIdsStr) return c.json({ error: "tagIds is required" }, 400);

  const tagIds = tagIdsStr.split(",");
  const contentService = getContentService();

  try {
    const result = await contentService.getContentsByTags(user.id, tagIds, limit, offset);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// List Contents
contentRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;
  const chunkId = c.req.query("chunkId");

  const contentService = getContentService();

  try {
    const result = await contentService.getContentsByUserId(user.id, limit, offset, chunkId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Update Content
contentRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const user = c.get("user");
  const contentService = getContentService();

  try {
    const result = await contentService.updateContent({
      id,
      userId: user.id,
      title: data.title,
      content: data.content,
      contentType: data.contentType,
    }, c.executionCtx);

    if (!result) return c.json({ error: "Content not found" }, 404);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Delete Content
contentRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const contentService = getContentService();

  const success = await contentService.deleteContent(id, user.id);
  if (!success) return c.json({ error: "Content not found" }, 404);
  return c.json({ success: true });
});

// Get Content By ID
contentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const contentService = getContentService();

  const result = await contentService.getContentById(id);
  if (!result) return c.json({ error: "Content not found" }, 404);
  if (result.userId !== user.id) return c.json({ error: "Unauthorized" }, 403);

  return c.json(result);
});

// --- Tags ---

contentRouter.post("/:id/tags", async (c) => {
  const contentId = c.req.param("id");
  const { tagIds } = await c.req.json();
  const user = c.get("user");
  const contentTagService = getContentTagService();

  const success = await contentTagService.addTagsToContent({ tagIds, contentId, userId: user.id });
  return c.json({ success });
});

contentRouter.get("/:id/tags", async (c) => {
  const contentId = c.req.param("id");
  const user = c.get("user");
  const contentTagService = getContentTagService();

  try {
    const result = await contentTagService.getTagsOfContent({ contentId, userId: user.id });
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

export { contentRouter };
