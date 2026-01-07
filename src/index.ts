import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createAppContainer } from "./be/infra/di";
import { mountUserRoutes } from "./be/user";
import { mountTagRoutes } from "./be/tag";

const app = new Hono();

// Initialize DI Container
const container = createAppContainer();

// Enable CORS for frontend development
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Mount Domain Routes
const userApp = new Hono();
mountUserRoutes(userApp, container);
app.route("/api/user", userApp);

const tagApp = new Hono();
mountTagRoutes(tagApp, container);
app.route("/api/tag", tagApp);

// Serve static frontend only if built (useful for local dev/testing)
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
