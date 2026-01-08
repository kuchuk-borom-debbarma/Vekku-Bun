import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRouter } from "./modules/auth/auth.routes";
import { tagRouter } from "./modules/tags/tags.routes";

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // Mount Routes
  app.route("/api/user", authRouter);
  app.route("/api/tag", tagRouter);

  return app;
};

export default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch(request: Request, env: Bindings, ctx: any) {
    const app = createApp(env || process.env);
    return app.fetch(request, env, ctx);
  },
};