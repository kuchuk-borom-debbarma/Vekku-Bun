# Vekku-Bun

## Project Overview

**Vekku-Bun** is a backend service built with the **Bun** runtime, focusing on high-performance data handling. It utilizes **Drizzle ORM** for database interactions (PostgreSQL via Neon Serverless) and includes advanced features like deterministic UUID generation and a specialized segmented pagination system.

### Core Technologies
-   **Runtime:** Bun
-   **Language:** TypeScript
-   **Database:** PostgreSQL (Neon Serverless)
-   **ORM:** Drizzle ORM
-   **Auth:** Custom (JWT + Bun Native Password Hashing)
-   **Utilities:** `uuid` (Standard & v5 Deterministic), `hono/jwt`

## Architecture & Features

### 1. Chunk-Based Two-Step Pagination
The project implements a **Chunk-Based Two-Step Pagination** strategy to solve the performance issues of deep offsets while maintaining user-friendly page numbers within local segments.

*   **Location:** `src/be/tag/_internal/TagService.ts`
*   **Documentation:** `docs/cursor-anchored-pagination.md`
*   **Key Concept:**
    *   **Chunks:** Data is viewed in large windows (e.g., 2,000 items).
    *   **Two-Step Fetch:** 
        1.  Fetch **IDs only** for the chunk (Index Scan).
        2.  Slice IDs in memory (Offset/Limit) and fetch **full data** only for the requested page.
    *   **Stateless Navigation:** The `nextChunkId` allows jumping to the next segment efficiently.

### 2. UUID Handling
*   **Location:** `src/util/UUID.ts` (Inferred)
*   **Strategy:** Uses `uuid` library. Supports standard v4 and deterministic v5 (Name-based) generation.
*   **Usage:** Tags use deterministic UUIDs generated from `[tagName, userId]` to ensure uniqueness per user-tag pair without extra DB lookups.

### 3. Dependency Injection (Awilix)
The project uses **Awilix** for platform-agnostic dependency injection. 
*   **Composition Root:** `src/be/infra/di.ts` is the single entry point where the container is initialized and common infrastructure (DB, Hasher) is registered.
*   **Domain Manifests:** Each domain (e.g., `user`, `tag`) exports a `registerDomain(container)` function in its `index.ts`. This encapsulates domain-specific registrations (Services, Routers) and prevents `_internal` implementation details from leaking to the root container.
*   **Constructor Injection:** Services use object destructuring in their constructors: `constructor({ db, hasher }: Deps)`.

### 4. Custom Authentication & Platform Abstraction
*   **Hasher Abstraction:** `IHasher` interface allows swapping between `BunHasher` (native C++) and `WebHasher` (Standard Web Crypto) depending on the deployment platform.
*   **Flow:** `triggerEmailVerification` (OTP) -> `verifyEmail` (Registration) -> `login` (JWT) -> `refreshToken` (Rotation).

## Building and Running

### Prerequisites
*   Bun (latest)
*   PostgreSQL instance (Neon)

### Commands
| Command | Description |
| :--- | :--- |
| `bun install` | Install dependencies. |
| `bun run dev:be` | Start the backend API server. |
| `bun run dev:fe` | Start the frontend React bundler (watch). |
| `bun run dev:all` | Start both FE and BE concurrently. |
| `bun test` | Run unit tests (uses `bun:test`). |
| `bun run db:push` | Sync database schema (Development). |
| `bun run db:generate` | Generate SQL migrations (Production). |
| `bun run db:studio` | Open visual database editor. |

## Development Conventions

*   **Database Access:** All DB interactions go through the injected `db` instance.
*   **Types & Imports:** 
    *   **Strict Typing:** Always resolve compilation errors.
    *   **Type-Only Imports:** Due to `verbatimModuleSyntax`, use `import type { ... }` when importing interfaces or types to avoid runtime side effects and compilation errors (TS 1484).
*   **Boundaries:** Enforced via ESLint.
    *   **Opaque Domains:** Domains are strictly private. External modules can **only** import from `index.ts` (manifests/types) or `api.ts` (interfaces).
    *   **Infra:** Accessible via `src/be/infra/**`.
*   **Testing:** Unit tests must use manual dependency injection. Do not rely on `mock.module` for injected dependencies; pass mock objects directly to the constructor.
*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.