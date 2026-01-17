# Project Architecture

Vekku-Bun follows a **Modular Layered** architecture designed for simplicity, ease of maintenance, and platform independence (Bun / Cloudflare Workers).

## Core Principles

1.  **Platform Agnostic:** The core logic depends only on standard Web APIs (Request/Response) and abstract interfaces. We use an **Adapter Pattern** at the entry point (`src/index.ts`) to inject platform-specific secrets into the application.
2.  **Event-Driven:** Heavy operations (like AI Embedding generation) are decoupled from the main request loop using an internal Event Bus.
3.  **Explicit Dependencies:** Services receive their dependencies (like `db` or `config`) either via constructor injection or via the singleton adapter configured at startup.

## Directory Structure

```text
src/
├── db/              # Database Layer
│   ├── index.ts     # Connection factory (Singleton Adapter)
│   ├── schema.ts    # Domain tables
│   └── auth-schema.ts # Auth tables
├── lib/             # Shared Utilities
│   ├── events/      # Event Bus & Topics
│   ├── auth.ts      # Better Auth config
│   ├── hashing.ts   # Hashing utilities
│   └── ...
├── modules/         # Feature Modules
│   ├── tags/
│   │   ├── Routes.ts        # Hono Routes
│   │   ├── TagServiceImpl.ts # Business Logic (Class)
│   │   └── tags.test.ts     # Tests
│   └── ...
└── index.ts         # App Entry Point & Adapter Layer
```

## Layer Description

### 1. The Entry Point / Adapter (`src/index.ts`)
*   **Responsibility:** "Wires" the application to the runtime environment.
*   **Injection:** It extracts secrets (DB URL, API Keys) from `env` (Cloudflare) or `process.env` (Node) and initializes the global configuration for services.
*   **Hono App:** Creates the Hono instance and mounts the routes.

### 2. Routes (`Routes.ts`)
*   **Responsibility:** Handle HTTP requests, parse inputs, check permissions (via Context), and call Services.
*   **Context:** Uses `c.get('user')` for auth context.

### 3. Services (`*ServiceImpl.ts`)
*   **Responsibility:** Pure business logic and database interactions.
*   **Structure:** Classes implementing Interfaces (e.g., `TagServiceImpl implements ITagService`).
*   **Event Publishing:** Services publish events (e.g., `TAG.CREATED`) instead of calling other services directly for side effects.

### 4. Database (`src/db`)
*   Centralizes schema definitions.
*   Provides `getDb()` singleton. This singleton is initialized by the Adapter layer at request start.

### 5. Semantic Tagging & Suggestion Engine
*   **Documentation:** `docs/development/embedding-suggestions.md`
*   **Strategy:** Uses `pgvector` for storing embeddings.
*   **Concept:** Separates "Global Concepts" (embeddings) from "User Tags" (links) to optimize storage.

## Event-Driven Architecture

We use a lightweight, in-memory Event Bus (`src/lib/events`) to decouple modules.

*   **Publisher:** `TagService` publishes `TAG.CREATED`.
*   **Subscriber:** `SuggestionListener` subscribes to `TAG.CREATED`.
*   **Benefit:** The user gets a fast response after creating a tag. The heavy AI embedding generation happens in the background (using `ctx.waitUntil` on Cloudflare).