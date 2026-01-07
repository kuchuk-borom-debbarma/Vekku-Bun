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

### 1. Hybrid Cursor-Anchored Pagination
The project implements a **Bi-Directional Stateless Segmented Pagination** strategy to solve the performance issues of deep offsets while maintaining user-friendly page numbers.

*   **Location:** `src/be/tag/_internal/TagService.ts`
*   **Documentation:** `docs/cursor-anchored-pagination.md`
*   **Key Concept:**
    *   **Segments:** Data is split into fixed windows (e.g., 2,000 items).
    *   **Anchors:** Cursors (Timestamp + ID) marking the start of a segment.
    *   **Offsets:** Fast, bounded offsets used *within* a segment.
    *   **Stateless Navigation:** The backend calculates both `nextAnchorId` (Forward scan) and `prevAnchorId` (Backward scan) in parallel, allowing users to jump between segments without client-side history state.

### 2. UUID Handling
*   **Location:** `src/util/UUID.ts` (Inferred)
*   **Strategy:** Uses `uuid` library. Supports standard v4 and deterministic v5 (Name-based) generation.
*   **Usage:** Tags use deterministic UUIDs generated from `[tagName, userId]` to ensure uniqueness per user-tag pair without extra DB lookups.

## Building and Running

### Prerequisites
*   Bun (latest)
*   PostgreSQL instance (Neon)

### Commands
| Command | Description |
| :--- | :--- |
| `bun install` | Install dependencies. |
| `bun run dev` | Start the development server (check `package.json` scripts). |
| `bun run build` | Build the project. |

## Development Conventions

*   **Database Access:** All DB interactions go through Drizzle.
*   **Entities:** Defined in `src/be/**/_internal/entities/`.
*   **Services:** Business logic resides in `Service` classes extending abstract interfaces.
*   **Pagination:** Always use the `getTagsOfUser` pattern (3-query parallel execution) for listing large datasets.
*   **Type Safety:** Strict TypeScript usage with Drizzle's inferred types.
