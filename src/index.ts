import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { userRouter } from "./be/user";
import { tagRouter } from "./be/tag";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/user", userRouter);
app.route("/api/tag", tagRouter);

app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
