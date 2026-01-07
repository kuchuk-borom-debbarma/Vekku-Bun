import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createAppContainer } from "./be/infra/di";
import type { UserController } from "./be/user/_internal/UserController";
import type { TagController } from "./be/tag/_internal/TagController";

const app = new Hono();

// Initialize DI Container
const container = createAppContainer();

// Enable CORS for frontend development
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Mount Domain Routes via Controllers
const userController = container.resolve<UserController>("userController");
app.route("/api/user", userController.routes());

const tagController = container.resolve<TagController>("tagController");
app.route("/api/tag", tagController.routes());

// Serve static frontend only if built (useful for local dev/testing)
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
