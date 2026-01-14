import { Hono } from "hono";
import { getTagSuggestionService } from "./index";
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

const suggestionRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to protect all suggestion routes
suggestionRouter.use("*", async (c, next) => {
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

suggestionRouter.get("/content/:contentId", async (c) => {
  const contentId = c.req.param("contentId");
  const suggestionService = getTagSuggestionService();

  const result = await suggestionService.getSuggestionsForContent(contentId);
  return c.json(result);
});

export { suggestionRouter };
