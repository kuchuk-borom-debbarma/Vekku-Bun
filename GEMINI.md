# Vekku-Bun

## Project Overview

**Vekku-Bun** is a backend service built with the **Bun** runtime, focusing on high-performance data handling. It utilizes **Drizzle ORM** for database interactions (PostgreSQL via Neon Serverless) and includes advanced features like deterministic UUID generation and a specialized segmented pagination system.

### Core Technologies
-   **Runtime:** Bun
-   **Language:** TypeScript
-   **Database:** PostgreSQL (Neon Serverless)
-   **ORM:** Drizzle ORM
-   **Auth:** Custom (JWT + Bun Native Password Hashing)
-   **Deployment:** Cloudflare Workers (Platform Agnostic API)
-   **Utilities:** `uuid` (Standard & v5 Deterministic), `hono/jwt`

## Architecture & Features

### 0. API Flow & Logic
A detailed documentation of all API endpoints and their internal data flows (DB, Cache, AI, Events) can be found here:
*   **Documentation:** `docs/api-flow.md`

### 1. Chunk-Based Two-Step Pagination
The project implements a **Chunk-Based Two-Step Pagination** strategy to solve the performance issues of deep offsets while maintaining user-friendly page numbers within local segments.

*   **Location:** `src/modules/tags/tags.service.ts`
*   **Documentation:** `docs/development/cursor-anchored-pagination.md`

### 2. Functional Architecture
The project uses a **Modular Functional** architecture.
*   **Documentation:** `docs/development/architecture.md`
*   **Concept:** Services are collections of pure functions that accept dependencies (like `db`) as arguments. Routes handle the "wiring" of these dependencies.

### 3. Authentication (Custom Stateless)
*   **Documentation:** `docs/development/custom-auth.md`
*   **Strategy:** Stateless Registration Token + JWT Login.
*   **Flow:** Signup details are signed into a JWT link. User creation happens only upon verification.

### 4. Platform Agnostic & Portability
The project is architected to be **Runtime Agnostic**, allowing seamless switching between **Bun** (local development/high-performance compute) and **Cloudflare Workers** (edge deployment).

*   **Hono Framework:** Used as the universal adapter. All business logic and routes must remain decoupled from runtime-specific globals (like `process.env` or `Bun.env`).
*   **The Adapter Pattern (`src/index.ts`):** Runtime-specific configurations (Database URLs, Secrets, AI API keys) must be injected through the Hono `fetch` handler into the global service state.
*   **Compatibility First:** When using external SDKs (e.g., Upstash, Cloudflare AI), always implement shims or overrides to handle runtime differences (like `fetch` behavior variations between Bun and Workers).
*   **Neon HTTP:** Database connections use `drizzle-orm/neon-http` for stateless, serverless-friendly connections that work across any runtime supporting standard `fetch`.

## Building and Running

### Prerequisites
*   Bun (latest)
*   PostgreSQL instance (Neon)

### Commands

| Command | Description |

| :--- | :--- |

| `bun install` | Install dependencies. |

| `bun run dev` | Start the backend API server. |

| `bun test` | Run unit tests (uses `bun:test`). |

| `bun run db:push` | Sync database schema (Development). |

| `bun run db:generate` | Generate SQL migrations (Production). |

| `bun run db:studio` | Open visual database editor. |



## Development Conventions

*   **Learning Mode:** The user is strictly in **learning mode**. Do NOT write or implement code automatically. Instead, provide high-level guidance, architectural plans, and code snippets only when asked. The goal is for the user to write the code themselves.
*   **Code Reviews:** After the user implements a feature, offer to review the code for best practices, performance, and adherence to project conventions.

*   **Database Access:** Use `getDb(url)` to obtain a connection. Pass this connection to service functions.

*   **Functional Style:** Avoid Classes for services. Use exported functions.

*   **Testing:** Mock dependencies by passing mock objects directly to function arguments.

*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.

### 5. Web UI Tester
A simple HTML/JS dashboard is available in `test/web-ui` to test Auth, Tags, and Content flows visually.
*   **Run:** `bun run test:ui` (serves on port 8080).

### 6. Database Extensions
*   **pgvector:** Required for embeddings.
*   **pg_search:** Required for advanced full-text search (Neon/ParadeDB).

## Recent Refactors
*   **Semantic Tagging:** `tag_suggestions` table was renamed to `content_tag_suggestions`. Tags now directly link to `tag_embeddings` via `fk_embedding_id`.