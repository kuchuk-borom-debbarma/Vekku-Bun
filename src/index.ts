import { Hono } from "hono";
import { cors } from "hono/cors";
import { tagRouter } from "./modules/tags/tags.routes";
import { getAuth } from "./lib/auth";
import { sessionMiddleware } from "./lib/auth-middleware";

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

type Variables = {
  user: any; // Ideally use Better Auth's inferred types
  session: any;
};

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  app.use("/api/*", cors());
  app.use("/api/*", sessionMiddleware);

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // Better Auth Handler
  app.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = getAuth(c.env.DATABASE_URL);
    return auth.handler(c.req.raw);
  });

  // Mount Routes
  app.route("/api/tag", tagRouter);

  return app;
};

export default {
  fetch(request: Request, env: Bindings, ctx: any) {
    // Bun's native fetch handler might not pass env if not using specific runners
    // So we explicitly fallback to process.env
    const bindings = { ...process.env, ...env } as Bindings;
    const app = createApp(bindings);
    return app.fetch(request, bindings, ctx);
  },
};
