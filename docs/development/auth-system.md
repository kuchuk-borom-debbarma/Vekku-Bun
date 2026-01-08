# Authentication System (Better Auth)

Vekku-Bun uses **[Better Auth](https://www.better-auth.com/)** for secure, session-based authentication.

## Overview

We utilize a **Magic Link** (Passwordless) strategy. Users provide an email, receive a secure link, and are logged in upon clicking it.

*   **Provider:** Magic Link (Email)
*   **Session:** Database-backed sessions (PostgreSQL)
*   **ORM:** Drizzle ORM
*   **Schema:** `src/db/auth-schema.ts` (Auto-generated)

## Components

### 1. Configuration (`src/lib/auth.ts`)
The central configuration factory. It sets up the Drizzle adapter and plugins.

```typescript
export const getAuth = (databaseUrl: string) => {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    plugins: [
      magicLink({ ... })
    ]
  });
};
```

### 2. Middleware (`src/lib/auth-middleware.ts`)
A Hono middleware that runs on protected routes (e.g., `/api/*`).
1.  Inspects the request headers.
2.  Calls `auth.api.getSession`.
3.  Injects the result into the Hono Context:
    *   `c.get('user')`: The authenticated user object.
    *   `c.get('session')`: The active session object.

### 3. Usage in Routes
Routes assume the user is authenticated (enforced by middleware check) and access the user ID directly from context.

```typescript
// src/modules/tags/tags.routes.ts
tagRouter.post("/", async (c) => {
  const user = c.get("user"); // Guaranteed to exist if middleware passed
  // ... create tag for user.id
});
```

## Database Schema
Better Auth requires specific tables which are defined in `src/db/auth-schema.ts`:
*   `user`
*   `session`
*   `account`
*   `verification` (Stores Magic Link tokens)

## Development Flow
In development mode (no email provider), Magic Links are logged to the **Server Console**.
1.  POST `/api/auth/sign-in/magic-link` with `{ email: "..." }`.
2.  Copy the URL from the terminal.
3.  Visit the URL to create a session.
