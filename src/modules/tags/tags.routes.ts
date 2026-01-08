import { Hono } from "hono";
import { getDb } from "../../db";
import * as tagService from "./tags.service";

type Bindings = {
  DATABASE_URL: string;
};

const tagRouter = new Hono<{ Bindings: Bindings }>();

tagRouter.post("/", async (c) => {
  const data = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);
  
  const result = await tagService.createTag(db, data);
  return c.json(result);
});

tagRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.updateTag(db, { ...data, id });
  return c.json(result);
});

tagRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { userId } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.deleteTag(db, { id, userId });
  return c.json({ success: result });
});

tagRouter.get("/", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "userId is required" }, 400);
  
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const db = getDb(c.env.DATABASE_URL);

  const result = await tagService.getTagsOfUser(db, { userId, chunkId, limit, offset });
  return c.json(result);
});

export { tagRouter };
