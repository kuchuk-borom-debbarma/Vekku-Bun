import { Hono } from "hono";
import { registerRoutes, type AppContext } from "../infra/AppRegistry.ts";
import { TagServiceImpl } from "./_internal/TagServiceImpl";

registerRoutes((app: Hono, { db }: AppContext) => {
  const tagService = new TagServiceImpl({ db });

  const tag = app.basePath("/api/tag");

  tag.post("/", async (c) => {
    const data = await c.req.json();
    const result = await tagService.createTag(data);
    return c.json(result);
  });

  tag.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await c.req.json();
    const result = await tagService.updateTag({ ...data, id });
    return c.json(result);
  });

  tag.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const { userId } = await c.req.json();
    const result = await tagService.deleteTag({ id, userId });
    return c.json({ success: result });
  });

  tag.get("/", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId is required" }, 400);
    
    const chunkId = c.req.query("chunkId");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
    const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

    const result = await tagService.getTagsOfUser({ userId, chunkId, limit, offset });
    return c.json(result);
  });
});
