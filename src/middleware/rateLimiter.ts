import type { Context, Next } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "../lib/redis";

// Create a map to store limiters with different configurations if needed
// For now, we use a single global limiter instance lazily initialized
let ratelimit: Ratelimit | null = null;

const getRatelimit = () => {
  if (ratelimit) return ratelimit;

  try {
    const redis = getRedisClient();
    ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
      analytics: true,
      /**
       * Ephemeral Cache (Memory Cache)
       * ------------------------------
       * Critical for serverless environments (Cloudflare Workers, Lambda).
       * It caches block decisions in memory for a short duration, preventing
       * unnecessary Redis calls for already blocked users or high-traffic bursts.
       */
      ephemeralCache: new Map(), 
      prefix: "@upstash/ratelimit",
    });
    return ratelimit;
  } catch (error) {
    // Redis not configured
    return null;
  }
};

export const rateLimiter = async (c: Context, next: Next) => {
  const limiter = getRatelimit();

  // If Rate Limiting is not configured (e.g. missing env vars), skip it (Fail Open)
  if (!limiter) {
    return next();
  }

  // Identify user: Prioritize User ID (if auth), otherwise IP
  // Note: Ensure your Auth middleware runs BEFORE this if you want to limit by User ID
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "127.0.0.1";
  
  // TODO: If you want to limit by User ID, extract it here from c.get('user') or similar
  // const userId = c.get("jwtPayload")?.sub;
  // const identifier = userId || ip;
  const identifier = ip;

  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  c.header("X-RateLimit-Limit", limit.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", reset.toString());

  if (!success) {
    return c.text("Too Many Requests", 429);
  }

  await next();
};
