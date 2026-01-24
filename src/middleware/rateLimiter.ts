import type { Context, Next } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "../lib/redis";

// Create a map to store limiters with different configurations if needed
// For now, we use a single global limiter instance lazily initialized
let ratelimit: Ratelimit | null = null;

export const getRatelimit = () => {
  if (ratelimit) return ratelimit;

  try {
    const redis = getRedisClient();
    ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds (Global)
      analytics: true,
      ephemeralCache: new Map(), 
      prefix: "@upstash/ratelimit",
    });
    return ratelimit;
  } catch (error) {
    return null;
  }
};

let aiRatelimit: Ratelimit | null = null;

export const getAiRatelimit = () => {
  if (aiRatelimit) return aiRatelimit;
  try {
    const redis = getRedisClient();
    aiRatelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(3, "1 m"), // 3 requests per minute (AI intensive)
      analytics: true,
      ephemeralCache: new Map(),
      prefix: "@upstash/ai-ratelimit",
    });
    return aiRatelimit;
  } catch {
    return null;
  }
};

export const rateLimiter = async (c: Context, next: Next) => {
  const limiter = getRatelimit();
  if (!limiter) return next();

  // Identify by User ID if available, otherwise IP
  const user = c.get("user") as any;
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "127.0.0.1";
  const identifier = user?.id || ip;

  const { success, limit, reset, remaining } = await limiter.limit(identifier);
  console.log(`[RateLimit] Global Check - User: ${user?.id || 'anon'}, IP: ${ip}, Success: ${success}, Remaining: ${remaining}`);

  c.header("X-RateLimit-Limit", limit.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", reset.toString());

  if (!success) return c.json({ error: "Too many requests. Slow down." }, 429);
  await next();
};

export const aiRateLimiter = async (c: Context, next: Next) => {
  const limiter = getAiRatelimit();
  if (!limiter) return next();

  const user = c.get("user") as any;
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "127.0.0.1";
  const identifier = user?.id || ip;

  const { success, limit, reset, remaining } = await limiter.limit(identifier);
  console.log(`[RateLimit] AI Check - User: ${user?.id || 'anon'}, Success: ${success}, Remaining: ${remaining}`);

  c.header("X-AI-RateLimit-Limit", limit.toString());
  c.header("X-AI-RateLimit-Remaining", remaining.toString());
  c.header("X-AI-RateLimit-Reset", reset.toString());

  if (!success) return c.json({ error: "AI rate limit exceeded. Please wait a minute." }, 429);
  await next();
};
