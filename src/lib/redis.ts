import { Redis } from "@upstash/redis/cloudflare";

let redisConfig: { url: string; token: string } | null = null;
let redisClient: Redis | null = null;

export const setRedisConfig = (config: { url: string; token: string }) => {
  // Idempotency check: If config hasn't changed, do nothing.
  // This prevents unnecessary client recreation and preserves the RateLimiter's ephemeral cache.
  if (
    redisConfig &&
    redisConfig.url === config.url &&
    redisConfig.token === config.token
  ) {
    return;
  }

  redisConfig = config;
  // Reset client so it gets recreated with new config if needed
  redisClient = null;
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
