# Rate Limiting & Redis Integration

This document outlines the architecture and implementation of the Rate Limiting system in **Vekku-Bun**, which leverages **Upstash Redis** for high-performance, serverless-friendly traffic control.

## 1. Overview

The system implements a **Global Rate Limiter** to protect the API from abuse and excessive traffic. It uses a **"Fail Open"** strategy, ensuring that if the Redis service is unavailable or unconfigured, the application continues to function normally without blocking legitimate users.

### Core Technologies
*   **Database:** [Upstash Redis](https://upstash.com/) (Serverless Redis)
*   **Protocol:** HTTPS (via REST API) - Optimized for Edge/Serverless runtimes.
*   **SDKs:** `@upstash/redis` (Client) and `@upstash/ratelimit` (Algorithm implementation).

## 2. Architecture

### 2.1. Platform Agnostic Integration
Consistent with the project's [Platform Agnostic Setup](./platform-agnostic-setup.md), Redis credentials are **injected** at runtime rather than hardcoded or read directly from `process.env` within the services.

1.  **Adapter Layer (`src/index.ts`)**: The `fetch` handler extracts `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the environment.
2.  **Configuration Injection**: It calls `setRedisConfig()` from `src/lib/redis.ts`.
3.  **Lazy Initialization**: The Redis client is only instantiated when `getRedisClient()` is called for the first time.

### 2.2. Middleware Logic
The logic resides in `src/middleware/rateLimiter.ts`.

*   **Scope:** Applied globally to all `/api/*` routes.
*   **Algorithm:** **Sliding Window** (Fixed Window variant).
    *   *Current Policy:* **10 requests per 10 seconds**.
*   **Identification:**
    *   Primary: `CF-Connecting-IP` (Cloudflare Header).
    *   Fallback: `X-Forwarded-For` or `127.0.0.1`.
*   **Fail Open:** If Redis credentials are not set, the middleware immediately calls `next()`, bypassing checks.

## 3. Configuration

To enable rate limiting, the following environment variables are required:

```env
# Upstash Redis Console -> Database -> REST API
UPSTASH_REDIS_REST_URL="https://your-db-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-secret-token"
```

### Response Headers
When active, the API includes standard rate limit headers:

*   `X-RateLimit-Limit`: The maximum number of requests allowed in the current window.
*   `X-RateLimit-Remaining`: The number of requests remaining in the current window.
*   `X-RateLimit-Reset`: The Unix timestamp when the window resets.

## 4. Key Implementation Details

### `src/lib/redis.ts`
Manages the singleton instance of the Redis client. It allows for reconfiguration if the environment context changes (e.g., during hot reloads or testing). It includes an **Idempotency Check** to prevent unnecessary client recreation when the configuration hasn't changed, ensuring that the `Ratelimit` instance (and its local cache) persists across requests in warm workers.

### `src/middleware/rateLimiter.ts`
Uses the `@upstash/ratelimit` SDK to handle the atomic counter increments and window calculations.

**Critical Optimization:** We use `ephemeralCache` (a local Map) to cache block decisions in memory. This is essential for serverless environments (Cloudflare Workers) to reduce latency and Redis costs by blocking repeated requests locally.

```typescript
ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  ephemeralCache: new Map(), // <--- High Performance Local Cache
  prefix: "@upstash/ratelimit",
});
```

## 5. Future Improvements

*   **Authenticated User Limits:** Currently, limits are IP-based. We can enhance this to limit based on `userId` (from the JWT) to allow higher limits for logged-in users.
*   **Tiered Limiting:** Different limits for different user roles (e.g., Admin vs. User).
*   **Separate Database:** While we currently use a single Redis instance with prefixes, heavy-scale applications might benefit from a dedicated Redis instance solely for rate limiting to avoid cache eviction policies affecting security counters.
