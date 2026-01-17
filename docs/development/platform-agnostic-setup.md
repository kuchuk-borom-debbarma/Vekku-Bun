# Platform Agnostic Setup (The Adapter Pattern)

This project is designed to run on any JavaScript runtime supported by Hono (Cloudflare Workers, Bun, Node.js, Vercel, Deno) without changing the business logic.

## The Challenge

Different platforms handle environment variables differently:
*   **Node.js / Bun:** Global `process.env`.
*   **Cloudflare Workers:** Per-request `env` object passed to the `fetch` handler.

Accessing `process.env` directly in your services causes crashes on Cloudflare. Accessing the Cloudflare `env` object directly makes your code hard to test locally or run in CLI scripts.

## The Solution: The Adapter Pattern

We solve this by separating **Configuration Injection** (The "Wiring") from **Business Logic**.

### 1. The Entry Point (`src/index.ts`)

This file acts as the **Adapter**. It is the only place in the app that is "Platform Aware".

```typescript
// src/index.ts
export default {
  fetch(request: Request, env: Bindings, ctx: any) {
    // 1. ADAPT: Take platform-specific env (Cloudflare or Bun)
    // 2. INJECT: Push it into platform-agnostic configuration setters
    
    // Inject Database Connection
    getDb(env.DATABASE_URL);

    // Inject JWT Secret
    if (env.JWT_SECRET) {
      setJwtSecret(env.JWT_SECRET);
    }

    // Inject AI Config
    setEmbeddingConfig({
      accountId: env.CLOUDFLARE_WORKER_ACCOUNT_ID,
      apiKey: env.CLOUDFLARE_WORKER_AI_API_KEY,
    });

    // 3. RUN: Start the Hono App
    return app.fetch(request, bindings, ctx);
  },
};
```

### 2. The Services (Platform Agnostic)

Your core libraries (`src/lib/*.ts`, `src/modules/*`) **never** access `process.env` or `c.env` directly. Instead, they export setter functions or use Singleton getters that are initialized by the Adapter.

**Example: `src/lib/jwt.ts`**

```typescript
let SECRET_KEY = "default-dev-key"; // Safe default

// The Adapter calls this at startup
export const setJwtSecret = (secret: string) => {
  SECRET_KEY = secret;
};

export const generateToken = () => {
  return sign(payload, SECRET_KEY); // Uses the injected value
};
```

## Benefits

1.  **Write Once, Run Anywhere:** You can deploy to Cloudflare, switch to a Node.js Docker container, or run locally with Bun just by changing the `src/index.ts` entry point logic. The rest of the app remains untouched.
2.  **Testability:** In tests, you don't need to mock `process.env`. You just call `setJwtSecret("test-secret")` before running your tests.
3.  **Stability:** No more `ReferenceError: process is not defined` crashes.

## Adding New Environment Variables

1.  Add the variable to `wrangler.toml` (for Cloudflare) and `.env` (for local).
2.  Update the `Bindings` type in `src/index.ts`.
3.  Create a setter/config function in the relevant module (e.g., `src/lib/my-module.ts`).
4.  Call that setter in the `fetch` handler in `src/index.ts`.
