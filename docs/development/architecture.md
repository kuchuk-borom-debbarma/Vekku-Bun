# Project Architecture

Vekku-Bun follows a **Modular Functional** architecture designed for simplicity, ease of maintenance, and platform independence (Bun / Cloudflare Workers).

## Core Principles

1.  **Simplicity First:** Prefer simple exported functions over Classes and Dependency Injection containers.
2.  **Explicit Dependencies:** Functions receive their dependencies (like `db`) as arguments. No global state or "magic" context injection inside services.
3.  **Platform Agnostic:** The core logic depends only on standard Web APIs (Request/Response) and abstract interfaces, making it deployable on any edge runtime supported by Hono.

## Directory Structure

```text
src/
├── db/              # Database Layer
│   ├── index.ts     # Connection factory (getDb)
│   ├── schema.ts    # Domain tables
│   └── auth-schema.ts # Auth tables
├── lib/             # Shared Utilities
│   ├── auth.ts      # Better Auth config
│   ├── hashing.ts   # Hashing utilities
│   └── ...
├── modules/         # Feature Modules
│   ├── tags/
│   │   ├── tags.routes.ts   # Hono Routes
│   │   ├── tags.service.ts  # Pure business logic
│   │   └── tags.test.ts     # Tests
│   └── ...
└── index.ts         # App Entry Point & Wiring
```

## Layer Description

### 1. Routes (`*.routes.ts`)
*   **Responsibility:** Handle HTTP requests, parse inputs, check permissions (via Context), and call Services.
*   **Dependency Injection:** The route handler is responsible for instantiating/retrieving dependencies (e.g., getting `db` from `env`) and passing them to the Service.

```typescript
// Example
tagRouter.post("/", async (c) => {
  const db = getDb(c.env.DATABASE_URL); // Retrieve Dependency
  const result = await createTag(db, data); // Inject into Service
  return c.json(result);
});
```

### 2. Services (`*.service.ts`)
*   **Responsibility:** Pure business logic and database interactions.
*   **Structure:** Exported functions.
*   **Dependencies:** First argument is usually the Database or other services.

```typescript
// Example
export const createTag = async (db: NeonHttpDatabase, data: TagData) => {
  return db.insert(...).values(...);
};
```

### 3. Database (`src/db`)
*   Centralizes schema definitions.
*   Provides `getDb(url)` to create a connection. Using `neon-http` for serverless compatibility.

### 4. Semantic Tagging & Suggestion Engine
*   **Documentation:** `docs/development/embedding-suggestions.md`
*   **Strategy:** Uses `pgvector` for storing embeddings and `HNSW` indexes for fast similarity search.
*   **Concept:** Separates "Global Concepts" (embeddings) from "User Tags" (links) to optimize storage and allow user-scoped vector searches.

## Testing Strategy
Tests are co-located with modules (`*.test.ts`).
*   **Mocking:** Since services take dependencies as arguments, testing is straightforward. We create mock DB objects and pass them directly to the service functions.
