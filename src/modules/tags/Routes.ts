import { Hono } from "hono";
import { getTagService } from "./index";
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

const tagRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all tag routes
tagRouter.use("*", async (c, next) => {
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

// Create Tags (Batch)
tagRouter.post("/", async (c) => {
  const { tags } = await c.req.json();
  const user = c.get("user");
  const tagService = getTagService();

  if (!Array.isArray(tags)) {
    return c.json({ error: "Invalid input: 'tags' must be an array" }, 400);
  }

  try {
    const result = await tagService.createTags(
      tags.map((t: any) => ({
        name: t.name,
        semantic: t.semantic,
        userId: user.id,
      })),
      c.executionCtx,
    );
    return c.json(result, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Update Tag
tagRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const user = c.get("user");
  const tagService = getTagService();

  try {
    const result = await tagService.updateTag(
      {
        id,
        userId: user.id,
        name: data.name,
        semantic: data.semantic,
      },
      c.executionCtx,
    );

    if (!result) {
      return c.json({ error: "Tag not found or unauthorized" }, 404);
    }

    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// Delete Tag
tagRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const tagService = getTagService();

  const success = await tagService.deleteTag(
    { id, userId: user.id },
    c.executionCtx,
  );
  if (!success) {
    return c.json({ error: "Tag not found or unauthorized" }, 404);
  }

  return c.json({ success: true });
});

tagRouter.get("/", async (c) => {
  const user = c.get("user");
  const query = c.req.query("q");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const tagService = getTagService();

  if (query) {
    const result = await tagService.searchTags({
      userId: user.id,
      query,
      limit,
      offset,
    });
    return c.json(result);
  }

  const result = await tagService.getTagsOfUser({ userId: user.id, chunkId, limit, offset });
  return c.json(result);
});

export { tagRouter };