import { Hono } from "hono";
import { getContentService } from "./index";
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
    const result = await contentService.createContent({
      title: data.title,
      content: data.content,
      contentType: data.contentType || ContentType.PLAIN_TEXT,
      userId: user.id,
    });
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
    const result = await contentService.updateContent({
      id,
      userId: user.id,
      title: data.title,
      content: data.content,
      contentType: data.contentType,
    });

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

export { contentRouter };
