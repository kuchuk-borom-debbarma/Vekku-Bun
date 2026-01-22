import { Redis } from "@upstash/redis/cloudflare";
import { resetRateLimiter } from "../middleware/rateLimiter";

let redisConfig: { url: string; token: string } | null = null;
let redisClient: Redis | null = null;

export const setRedisConfig = (config: { url: string; token: string }) => {
  redisConfig = config;
  // Reset client so it gets recreated with new config if needed
  redisClient = null;
  // Also reset the rate limiter so it picks up the new client
  resetRateLimiter();
};

export const getRedisClient = (): Redis => {
  if (redisClient) return redisClient;

  if (!redisConfig) {
    throw new Error("Redis configuration not set. Call setRedisConfig() first.");
  }

  redisClient = new Redis({
    url: redisConfig.url,
    token: redisConfig.token,
  });

  return redisClient;
};
