import { Hono } from "hono";
import { getDb } from "../../db";
import * as tagService from "./tags.service";

type Bindings = {
  DATABASE_URL: string;
};

type Variables = {
  user: any;
  session: any;
};

const tagRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all tag routes
tagRouter.use("*", async (c, next) => {
  if (!c.get("user")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

tagRouter.post("/", async (c) => {
  const data = await c.req.json();
  const user = c.get("user");
  const db = getDb(c.env.DATABASE_URL);
  
  const result = await tagService.createTag(db, { ...data, userId: user.id });
  return c.json(result);
});

tagRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const user = c.get("user");
  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.updateTag(db, { ...data, id, userId: user.id });
  return c.json(result);
});

tagRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.deleteTag(db, { id, userId: user.id });
  return c.json({ success: result });
});

tagRouter.get("/", async (c) => {
  const user = c.get("user");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.getTagsOfUser(db, { userId: user.id, chunkId, limit, offset });
  return c.json(result);
});

export { tagRouter };
