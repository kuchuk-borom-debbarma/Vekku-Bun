# Vekku-Bun

## Project Overview

**Vekku-Bun** is a backend service built with the **Bun** runtime, focusing on high-performance data handling. It utilizes **Drizzle ORM** for database interactions (PostgreSQL via Neon Serverless) and includes advanced features like deterministic UUID generation and a specialized segmented pagination system.

### Core Technologies
-   **Runtime:** Bun
-   **Language:** TypeScript
-   **Database:** PostgreSQL (Neon Serverless)
-   **ORM:** Drizzle ORM
-   **Auth:** Better Auth
-   **Utilities:** `uuid` (Standard & v5 Deterministic)

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

### 3. Circular Dependency Prevention (Three-File Pattern)
To avoid circular dependencies between abstractions and implementations, services follow a strict three-file structure:
*   `api.ts`: Defines interfaces and types only. No implementation imports.
*   `_internal/Service.ts`: Implements the interface.
*   `index.ts`: The entry point. Imports both and exports the singleton instance (e.g., `export const tagService = new TagService()`).

## Building and Running

### Prerequisites
*   Bun (latest)
*   PostgreSQL instance (Neon)

### Commands
| Command | Description |
| :--- | :--- |
| `bun install` | Install dependencies. |
| `bun test` | Run unit tests (uses `bun:test`). |
| `bun run dev` | Start the development server. |
| `bun run build` | Build the project. |

## Development Conventions

*   **Database Access:** All DB interactions go through Drizzle. `src/be/infra/Drizzle.ts` is designed to be resilient during tests by checking for `DATABASE_URL`.
*   **Entities:** Defined in `src/be/**/_internal/entities/`.
*   **Services:** Business logic resides in `Service` classes extending abstract interfaces. Use the **Three-File Pattern** for all new services.
*   **Testing:** Unit tests reside alongside implementation (e.g., `TagService.test.ts`). Use `bun:test` and Chain Mocks for Drizzle's fluent API.
*   **Boundaries:** Enforced via ESLint (`eslint-plugin-boundaries`).
    *   **Domains:** `src/be/<domain>` (e.g., `tag`, `user`).
    *   **Rule:** Domains are opaque. External modules can **only** import from `index.ts` or `api.ts`.
    *   **Private:** `_internal` directories are strictly private to their domain.
*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.
*   **Type Safety:** Strict TypeScript usage with Drizzle's inferred types.