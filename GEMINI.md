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

### 4. Platform Agnostic
*   **Hono:** The core framework handles cross-platform compatibility.
*   **Neon HTTP:** Database connections use `drizzle-orm/neon-http` for stateless, serverless-friendly connections.

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







*   **Database Access:** Use `getDb(url)` to obtain a connection. Pass this connection to service functions.



*   **Functional Style:** Avoid Classes for services. Use exported functions.



*   **Testing:** Mock dependencies by passing mock objects directly to function arguments.



*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.




