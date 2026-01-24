import { Hono } from "hono";
import { cors } from "hono/cors";
import { tagRouter } from "./modules/tags/Routes";
import { authRouter } from "./modules/auth/Routes";
import { contentRouter } from "./modules/contents/Routes";
import { suggestionRouter } from "./modules/suggestions/Routes";
import { adminRouter } from "./modules/admin/Routes";
import { statsRouter } from "./modules/stats/Routes";
import { initSuggestionListeners } from "./modules/suggestions";
import { getDb } from "./db";
import { setJwtSecret } from "./lib/jwt";
import { setEmbeddingConfig } from "./lib/embedding";
import { setNotificationConfig } from "./lib/notification";
import { setRedisConfig } from "./lib/redis";
import { rateLimiter } from "./middleware/rateLimiter";

// Initialize global event listeners
initSuggestionListeners();

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET?: string;
  CLOUDFLARE_WORKER_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_AI_API_KEY?: string;
  CLOUDFLARE_AI_MODEL?: string;
  NOTIFICATION_API_CLIENT_ID?: string;
  NOTIFICATION_API_CLIENT_SECRET?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  WORKER?: string;
  GITHUB_URL?: string;
  GMAIL_URL?: string;
  FRONTEND_URL?: string;
};

const createApp = (env: Bindings) => {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/api/*", cors({
    origin: env.FRONTEND_URL || "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }));
  app.use("/api/*", rateLimiter);

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  
  app.get("/api/config", (c) => {
    return c.json({
      githubUrl: c.env.GITHUB_URL || "https://github.com",
      gmailUrl: c.env.GMAIL_URL || "mailto:admin@example.com",
    });
  });

  // Mount Routes
  app.route("/api/auth", authRouter);
  app.route("/api/tag", tagRouter);
  app.route("/api/content", contentRouter);
  app.route("/api/suggestions", suggestionRouter);
  app.route("/api/admin", adminRouter);
  app.route("/api/stats", statsRouter);

  return app;
};

export default {
  /**
   * THE ADAPTER LAYER
   * -----------------
   * This 'fetch' handler acts as the bridge between the specific runtime platform
   * (e.g., Cloudflare Workers, Bun, Node) and the application's core logic.
   */
  fetch(request: Request, env: Bindings, ctx: any) {
    // 1. Database Injection
    getDb(env.DATABASE_URL);

    // 2. JWT Configuration Injection
    if (env.JWT_SECRET) {
      setJwtSecret(env.JWT_SECRET);
    }

    // Initialize Embedding Config
    setEmbeddingConfig({
      accountId: env.CLOUDFLARE_WORKER_ACCOUNT_ID,
      apiKey: env.CLOUDFLARE_WORKER_AI_API_KEY,
      model: env.CLOUDFLARE_AI_MODEL,
    });
    // Initialize Notification Config
    setNotificationConfig({
      clientId: env.NOTIFICATION_API_CLIENT_ID,
      clientSecret: env.NOTIFICATION_API_CLIENT_SECRET,
    });

    // Initialize Redis Config
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      setRedisConfig({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    }

    // Polyfill ExecutionContext for Bun/Local environments
    if (!ctx) {
      ctx = {
        waitUntil: (promise: Promise<any>) => {
          promise.catch((err) => console.error("[Background Task Error]", err));
        },
        passThroughOnException: () => {},
      };
    }

    const processEnv = typeof process !== "undefined" ? process.env : {};
    const bindings = { ...processEnv, ...env } as Bindings;
    
    console.log("[App Init] Environment Check:", {
      DATABASE_URL_SET: !!bindings.DATABASE_URL,
      JWT_SECRET_SET: !!bindings.JWT_SECRET,
      WORKER_FLAG: bindings.WORKER,
    });

    const app = createApp(bindings);
    return app.fetch(request, bindings, ctx);
  },
};
