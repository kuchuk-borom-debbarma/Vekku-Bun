import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createAppContainer } from "./be/infra/di";

const app = new Hono();

// Initialize DI Container
const container = createAppContainer();
const userRouter = container.resolve<Hono>("userRouter");
const tagRouter = container.resolve<Hono>("tagRouter");

// Enable CORS for frontend development
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/user", userRouter);
app.route("/api/tag", tagRouter);

// Serve static frontend only if built (useful for local dev/testing)
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
