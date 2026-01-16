import { Hono } from "hono";
import { cors } from "hono/cors";
import { tagRouter } from "./modules/tags/Routes";
import { authRouter } from "./modules/auth/Routes";
import { contentRouter } from "./modules/contents/Routes";
import { suggestionRouter } from "./modules/suggestions/Routes";
import { initSuggestionListeners } from "./modules/suggestions";

// Initialize global event listeners
initSuggestionListeners();

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // Mount Routes
  app.route("/api/auth", authRouter);
  app.route("/api/tag", tagRouter);
  app.route("/api/content", contentRouter);
  app.route("/api/suggestions", suggestionRouter);

  return app;
};

export default {
  fetch(request: Request, env: Bindings, ctx: any) {
    const bindings = { ...process.env, ...env } as Bindings;
    const app = createApp(bindings);
    return app.fetch(request, bindings, ctx);
  },
};
