import { Hono } from "hono";
import { cors } from "hono/cors";
import { tagRouter } from "./modules/tags/Routes";
import { authRouter } from "./modules/auth/Routes";
import { contentRouter } from "./modules/contents/Routes";
import { suggestionRouter } from "./modules/suggestions/Routes";
import { adminRouter } from "./modules/admin/Routes";
import { initSuggestionListeners } from "./modules/suggestions";
import { getDb } from "./db";
import { setJwtSecret } from "./lib/jwt";
import { setEmbeddingConfig } from "./lib/embedding";
import { setNotificationConfig } from "./lib/notification";

// Initialize global event listeners
initSuggestionListeners();

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET?: string;
  CLOUDFLARE_WORKER_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_AI_API_KEY?: string;
  NOTIFICATION_API_CLIENT_ID?: string;
  NOTIFICATION_API_CLIENT_SECRET?: string;
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
  app.route("/api/admin", adminRouter);

  return app;
};

export default {
  /**
   * THE ADAPTER LAYER
   * -----------------
   * This 'fetch' handler acts as the bridge between the specific runtime platform
   * (e.g., Cloudflare Workers, Bun, Node) and the application's core logic.
   *
   * Its primary responsibility is Dependency Injection & Configuration:
   * 1. Extract secrets/bindings from the platform-specific 'env' object.
   * 2. Inject them into the application's global state or service configurations.
   *
   * This allows the Service Layer (TagServiceImpl, etc.) to remain "Platform Agnostic".
   * Services don't need to know they are running on Cloudflare; they just use the
   * injected configuration.
   */
  fetch(request: Request, env: Bindings, ctx: any) {
    // 1. Database Injection
    // Initialize the DB connection with the secret from the environment.
    // This sets the singleton instance used by 'getDb()' throughout the app.
    getDb(env.DATABASE_URL);

    // 2. JWT Configuration Injection
    if (env.JWT_SECRET) {
      setJwtSecret(env.JWT_SECRET);
    }

    // Initialize Embedding Config
    setEmbeddingConfig({
      accountId: env.CLOUDFLARE_WORKER_ACCOUNT_ID,
      apiKey: env.CLOUDFLARE_WORKER_AI_API_KEY,
    });

    // Initialize Notification Config
    setNotificationConfig({
      clientId: env.NOTIFICATION_API_CLIENT_ID,
      clientSecret: env.NOTIFICATION_API_CLIENT_SECRET,
    });

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
      WORKER_FLAG: bindings.WORKER
    });

    const app = createApp(bindings);
    return app.fetch(request, bindings, ctx);
  },
};

//TODO make this lighter
//TODO bug fix users can create same tags twice and this needs to be fixed
