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

tagRouter.post("/", async (c) => {
  const data = await c.req.json();
  const user = c.get("user");
  const tagService = getTagService();
  
  const result = await tagService.createTag({ ...data, userId: user.id });
  return c.json(result);
});

tagRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const user = c.get("user");
  const tagService = getTagService();

  const result = await tagService.updateTag({ ...data, id, userId: user.id });
  return c.json(result);
});

tagRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const tagService = getTagService();

  const result = await tagService.deleteTag({ id, userId: user.id });
  return c.json({ success: result });
});

tagRouter.get("/", async (c) => {
  const user = c.get("user");
  const chunkId = c.req.query("chunkId");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;

  const tagService = getTagService();

  const result = await tagService.getTagsOfUser({ userId: user.id, chunkId, limit, offset });
  return c.json(result);
});

export { tagRouter };