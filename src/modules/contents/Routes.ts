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

// Create Content
contentRouter.post("/", async (c) => {
  const data = await c.req.json();
  const user = c.get("user");
  const contentService = getContentService();

  try {
    const result = await contentService.createContent(
      {
        title: data.title,
        content: data.content,
        contentType: data.contentType || ContentType.PLAIN_TEXT,
        userId: user.id,
      },
      c.executionCtx,
    );

    // If tags are provided, link them
    if (
      result &&
      data.tagIds &&
      Array.isArray(data.tagIds) &&
      data.tagIds.length > 0
    ) {
      const contentTagService = getContentTagService();
      try {
        await contentTagService.addTagsToContent({
          contentId: result.id,
          tagIds: data.tagIds,
          userId: user.id,
        });
      } catch (tagError) {
        console.error("Failed to link tags during content creation:", tagError);
        // We don't fail the request, just log it.
        // The content was created successfully.
      }
    }

    return c.json(result, 201);
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
    const result = await contentService.updateContent(
      {
        id,
        userId: user.id,
        title: data.title,
        content: data.content,
        contentType: data.contentType,
      },
      c.executionCtx,
    );

    if (!result) {
      return c.json({ error: "Content not found or unauthorized" }, 404);
    }

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
  if (!success) {
    return c.json({ error: "Content not found or unauthorized" }, 404);
  }

  return c.json({ success: true });
});

// Get Content By ID
contentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const contentService = getContentService();

  const result = await contentService.getContentById(id);

  if (!result) {
    return c.json({ error: "Content not found" }, 404);
  }

  if (result.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json(result);
});

// List Contents (Pagination)
contentRouter.get("/", async (c) => {
  const user = c.get("user");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit")
    ? parseInt(c.req.query("limit")!)
    : undefined;
  const offset = c.req.query("offset")
    ? parseInt(c.req.query("offset")!)
    : undefined;

  const contentService = getContentService();

  try {
    const result = await contentService.getContentsByUserId(
      user.id,
      limit,
      offset,
      chunkId,
    );
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Get Contents by Tags
contentRouter.get("/by-tags", async (c) => {
  const user = c.get("user");
  const tagIdsStr = c.req.query("tagIds");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 20;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

  if (!tagIdsStr) {
    return c.json({ error: "tagIds query parameter is required" }, 400);
  }

  const tagIds = tagIdsStr.split(",").filter(id => id.trim().length > 0);
  const contentService = getContentService();

  try {
    const result = await contentService.getContentsByTags(
      user.id,
      tagIds,
      limit,
      offset,
      chunkId
    );
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// --- Content Tag Routes ---

// Add Tags to Content
contentRouter.post("/:id/tags", async (c) => {
  const contentId = c.req.param("id");
  const { tagIds } = await c.req.json();
  const user = c.get("user");
  const contentTagService = getContentTagService();

  if (!tagIds || !Array.isArray(tagIds)) {
    return c.json({ error: "tagIds must be an array" }, 400);
  }

  const success = await contentTagService.addTagsToContent({
    tagIds,
    contentId,
    userId: user.id,
  });

  return c.json({ success });
});

// Add Potential Tags (Keywords) to Content in Bulk
contentRouter.post("/:id/potential", async (c) => {
  const id = c.req.param("id");
  const { keywords } = await c.req.json();
  const user = c.get("user");

  if (!Array.isArray(keywords)) {
    return c.json({ error: "Invalid keywords array" }, 400);
  }

  const contentTagService = getContentTagService();
  const success = await contentTagService.addKeywordsToContent({
    keywords,
    contentId: id,
    userId: user.id,
  }, c.executionCtx);

  return c.json({ success });
});

contentRouter.delete("/:id/tags", async (c) => {
  const contentId = c.req.param("id");
  const { tagIds } = await c.req.json();
  const user = c.get("user");
  const contentTagService = getContentTagService();

  if (!tagIds || !Array.isArray(tagIds)) {
    return c.json({ error: "tagIds must be an array" }, 400);
  }

  const success = await contentTagService.removeTagsFromContent({
    contentId,
    tagIds,
    userId: user.id,
  });

  if (!success) {
    return c.json({ error: "Failed to remove tags" }, 500);
  }

  return c.json({ success: true });
});

// Get Tags of Content
contentRouter.get("/:id/tags", async (c) => {
  const contentId = c.req.param("id");
  const user = c.get("user");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit")
    ? parseInt(c.req.query("limit")!)
    : undefined;
  const offset = c.req.query("offset")
    ? parseInt(c.req.query("offset")!)
    : undefined;

  const contentTagService = getContentTagService();

  try {
    const result = await contentTagService.getTagsOfContent({
      contentId,
      userId: user.id,
      chunkId,
      limit,
      offset,
    });
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

export { contentRouter };
