import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/neon-http";
import { BunHasher } from "./be/infra/hashing/BunHasher";
import { WebHasher } from "./be/infra/hashing/WebHasher";
import { AuthService } from "./be/user/AuthService";
import { TagService } from "./be/tag/TagService";
import { userRouter } from "./be/user/routes";
import { tagRouter } from "./be/tag/routes";
import { type Bindings, type Variables } from "./context";

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  app.use("/api/*", cors());

  // Dependency Injection Middleware
  app.use(async (c, next) => {
    // 1. Infrastructure
    const db = drizzle(env.DATABASE_URL);
    const hasher = env.WORKER ? new WebHasher() : new BunHasher();

    // 2. Services
    const authService = new AuthService(db, hasher);
    const tagService = new TagService(db);

    // 3. Inject into Context
    c.set("db", db);
    c.set("hasher", hasher);
    c.set("authService", authService);
    c.set("tagService", tagService);

    await next();
  });

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // Mount Routes
  app.route("/api/user", userRouter);
  app.route("/api/tag", tagRouter);

  // Static Files (Only for Bun/Local)
  if (!env.WORKER) {
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", serveStatic({ path: "./dist/index.html" }));
  }

  return app;
};

export default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch(request: Request, env: Bindings, ctx: any) {
    const app = createApp(env || process.env);
    return app.fetch(request, env, ctx);
  },
};