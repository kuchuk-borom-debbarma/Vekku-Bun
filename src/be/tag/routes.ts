import { Hono } from "hono";
import { type Variables } from "../../context";

const tagRouter = new Hono<{ Variables: Variables }>();

tagRouter.post("/", async (c) => {
  const data = await c.req.json();
  const tagService = c.get("tagService");
  const result = await tagService.createTag(data);
  return c.json(result);
});

tagRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const tagService = c.get("tagService");
  const result = await tagService.updateTag({ ...data, id });
  return c.json(result);
});

tagRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const { userId } = await c.req.json();
  const tagService = c.get("tagService");
  const result = await tagService.deleteTag({ id, userId });
  return c.json({ success: result });
});

tagRouter.get("/", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "userId is required" }, 400);
  
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const tagService = c.get("tagService");
  const result = await tagService.getTagsOfUser({ userId, chunkId, limit, offset });
  return c.json(result);
});

export { tagRouter };
