import { Hono } from "hono";
import { getDb } from "../../db";
import * as contentService from "./contents.service";
import { verifyJwt } from "../../lib/jwt";
import { ContentType } from "./contents.service";

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
  const db = getDb(c.env.DATABASE_URL);

  try {
    const result = await contentService.createContent(db, {
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
  const db = getDb(c.env.DATABASE_URL);

  try {
    const result = await contentService.updateContent(db, {
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
  const db = getDb(c.env.DATABASE_URL);

  const success = await contentService.deleteContent(db, id, user.id);
  if (!success) {
    return c.json({ error: "Content not found or unauthorized" }, 404);
  }
  
  return c.json({ success: true });
});

// Get Content By ID
contentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = getDb(c.env.DATABASE_URL);

  const result = await contentService.getContentById(db, id);
  
  if (!result) {
    return c.json({ error: "Content not found" }, 404);
  }

  // Optional: Check if user owns content? 
  // For now, assuming contents are private to the user based on getContentsByUserId,
  // but getContentById in service doesn't strictly enforce userId, just ID.
  // However, usually we want to ensure ownership. 
  // Let's verify ownership:
  if (result.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json(result);
});

// List Contents (Pagination)
contentRouter.get("/", async (c) => {
  const user = c.get("user");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const db = getDb(c.env.DATABASE_URL);

  try {
    const result = await contentService.getContentsByUserId(db, user.id, limit, offset, chunkId);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

export { contentRouter };
