import { getRedisClient } from "./redis";

const DEFAULT_TTL = 60 * 5; // 5 minutes

export const CacheServiceUpstash = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const redis = getRedisClient();
      return await redis.get<T>(key);
    } catch (e) {
      // Fail open: log error but don't crash, return null (cache miss)
      console.error("[Cache Get Error]", e);
      return null;
    }
  },

  set: async (key: string, value: any, ttlSeconds: number = DEFAULT_TTL) => {
    try {
      const redis = getRedisClient();
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (e) {
      console.error("[Cache Set Error]", e);
    }
  },

  /**
   * Generates a consistent cache key from parts.
   * Handles null/undefined by converting them to string "null".
   */
  generateKey: (...parts: (string | number | null | undefined)[]) => {
    return parts
      .map((p) => (p === null || p === undefined ? "null" : String(p)))
      .join(":");
  },

  del: async (key: string) => {
    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch (e) {
      console.error("[Cache Del Error]", e);
    }
  },

  delByPattern: async (pattern: string) => {
    try {
      const redis = getRedisClient();
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = Number(nextCursor); // upstash/redis returns string cursor
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);
    } catch (e) {
      console.error("[Cache DelByPattern Error]", e);
    }
  },
};
