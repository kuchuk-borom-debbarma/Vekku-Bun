import { Hono } from "hono";
import type { ITagService } from "../api";

type TagControllerDeps = {
  tagService: ITagService;
};

export class TagController {
  private tagService: ITagService;

  constructor({ tagService }: TagControllerDeps) {
    this.tagService = tagService;
  }

  routes(): Hono {
    const router = new Hono();

    router.post("/", async (c) => {
      const data = await c.req.json();
      const result = await this.tagService.createTag(data);
      return c.json(result);
    });

    router.patch("/:id", async (c) => {
      const id = c.req.param("id");
      const data = await c.req.json();
      const result = await this.tagService.updateTag({ ...data, id });
      return c.json(result);
    });

    router.delete("/:id", async (c) => {
      const id = c.req.param("id");
      const { userId } = await c.req.json();
      const result = await this.tagService.deleteTag({ id, userId });
      return c.json({ success: result });
    });

    router.get("/", async (c) => {
      const userId = c.req.query("userId");
      if (!userId) return c.json({ error: "userId is required" }, 400);
      
      const chunkId = c.req.query("chunkId");
      const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
      const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

      const result = await this.tagService.getTagsOfUser({ userId, chunkId, limit, offset });
      return c.json(result);
    });

    return router;
  }
}
