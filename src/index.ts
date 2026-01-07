import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/neon-http";
import { BunHasher } from "./be/infra/hashing/BunHasher";
import { WebHasher } from "./be/infra/hashing/WebHasher";
import { applyRegistrations } from "./be/infra/AppRegistry";

// Import domains to trigger registration
import "./be/user/registry";
import "./be/tag/registry";

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/api/*", cors());

  // 1. Infrastructure
  const db = drizzle(env.DATABASE_URL);
  const hasher = env.WORKER ? new WebHasher() : new BunHasher();

  // 2. Apply all registered domain routes
  applyRegistrations(app, { db, hasher });

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // 3. Static Files (Only for Bun/Local)
  if (!env.WORKER) {
    app.use("/*", serveStatic({ root: "./dist" }));
    app.get("*", serveStatic({ path: "./dist/index.html" }));
  }

  return app;
};

export default {
  fetch(request: Request, env: Bindings, ctx: any) {
    const app = createApp(env || process.env);
    return app.fetch(request, env, ctx);
  },
};
