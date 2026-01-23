import { Hono } from "hono";
import { getDb } from "../../db";
import { verifyJwt } from "../../lib/jwt";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";

const statsRouter = new Hono();

statsRouter.get("/", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.split(" ")[1];
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  
  const payload = await verifyJwt(token);
  if (!payload || !payload.sub) return c.json({ error: "Unauthorized" }, 401);
  const userId = payload.sub as string;

  const db = getDb();

  const users = await db
    .select({ metadata: schema.user.metadata })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  const userRecord = users[0];
  if (!userRecord) return c.json({ error: "User not found" }, 404);

  const meta = userRecord.metadata as { contentCount?: number; tagCount?: number };

  return c.json({
    totalContents: Number(meta.contentCount || 0),
    totalTags: Number(meta.tagCount || 0),
  });
});

export { statsRouter };
