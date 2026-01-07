import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
