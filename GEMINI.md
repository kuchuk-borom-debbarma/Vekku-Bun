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

### 1. Chunk-Based Two-Step Pagination
The project implements a **Chunk-Based Two-Step Pagination** strategy to solve the performance issues of deep offsets while maintaining user-friendly page numbers within local segments.

*   **Location:** `src/be/tag/TagService.ts`
*   **Documentation:** `docs/development/cursor-anchored-pagination.md`
*   **Key Concept:**
    *   **Chunks:** Data is viewed in large windows (e.g., 2,000 items).
    *   **Two-Step Fetch:** 
        1.  Fetch **IDs only** for the chunk (Index Scan).
        2.  Slice IDs in memory (Offset/Limit) and fetch **full data** only for the requested page.
    *   **Stateless Navigation:** The `nextChunkId` allows jumping to the next segment efficiently.

### 2. UUID Handling
*   **Location:** `src/be/util/UUID.ts`
*   **Strategy:** Uses `uuid` library. Supports standard v4 and deterministic v5 (Name-based) generation.
*   **Usage:** Tags use deterministic UUIDs generated from `[tagName, userId]` to ensure uniqueness per user-tag pair without extra DB lookups.

### 3. Architecture: Hono Context Dependency Injection
The project uses a lightweight, platform-agnostic DI pattern leveraging **Hono Context** and **Interfaces**.
*   **Interfaces:** Services define contracts (`IAuthService`, `ITagService`) to decouple implementation from usage.
*   **Wiring (`src/index.ts`):** The application entry point manually instantiates concrete service classes (`AuthService`) and injects them into the Hono Context (`c.set('authService', service)`).
*   **Consumption:** Routes access services via `c.get('authService')`, ensuring they only depend on the interface.
*   **Platform Agnostic:** Infrastructure (DB, Hasher) is selected at runtime based on the environment (`env.WORKER`), allowing seamless deployment to Bun (Local/VPS) or Cloudflare Workers.

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

| `bun run dev` | Start the backend API server. |

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

    *   **Domain Encapsulation:** Domain logic is organized in `src/be/<domain>`. External modules should only import from public interfaces/routes.

    *   **Infra:** Accessible via `src/be/infra/**`.

*   **Testing:** Unit tests must use manual dependency injection. Do not rely on `mock.module` for injected dependencies; pass mock objects directly to the constructor.

*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.
