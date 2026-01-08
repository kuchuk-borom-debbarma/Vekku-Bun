# Chunk-Based Cursor Pagination

## Overview

This project uses a high-performance **Chunk-Based Two-Step Pagination Strategy**. It is designed to balance the performance of Cursor Pagination (O(1) access) with the flexibility of Offset Pagination (Page X of Y) within reasonable bounds.

### The Core Concept
Instead of fetching data page-by-page directly from the DB, we view data in large "Chunks" (e.g., 2,000 items).

1.  **The Chunk:** A large window of data identified by a cursor (`chunkId`).
2.  **The Page:** A small slice (e.g., 20 items) *within* that chunk, identified by an `offset`.

### The Problem it Solves
*   **Deep Offset Slowness:** Standard `OFFSET 5000` is slow because the DB reads and discards rows.
*   **Data Over-fetching:** Cursor pagination often makes "jumping" to page 5 difficult.

### The Solution
We use a **Two-Step Fetch**:
1.  **Map the Chunk:** We efficiently fetch *only the IDs* for the entire chunk (e.g., 2,000 IDs) using a cursor. This is extremely fast (Index Only Scan).
2.  **Fetch the Page:** We slice that list of IDs in memory (e.g., get IDs at index 40-60) and then fetch the *full data* for only those 20 rows.

---

## Technical Implementation

### 1. The Request
The frontend requests a page relative to a `chunkId`.

```typescript
interface PaginationRequest {
  limit: number;     // Items per page (e.g., 20)
  offset: number;    // Skip relative to the start of the chunk (e.g., 40)
  chunkId?: string;  // The ID starting this chunk (null = Start of list)
}
```

### 2. The Execution Flow (`src/modules/tags/tags.service.ts`)

#### Step A: Resolve Cursor
If a `chunkId` is provided, we look up its creation timestamp to establish the cursor position (`WHERE (created_at, id) <= (cursor_date, cursor_id)`).

#### Step B: Fetch Chunk IDs (The "Map")
We fetch `SEGMENT_SIZE + 1` IDs.
*   **Why +1?** To detect if there is a "Next Chunk" available.
*   **Performance:** Since we only select `id`, this hits the database index directly without touching the heap (table data).

#### Step C: In-Memory Slicing
We calculate which IDs belong to the requested page:
`pageIds = chunkIds.slice(offset, offset + limit)`

#### Step D: Fetch Data
We run a final query: `SELECT * FROM tags WHERE id IN (pageIds)`.
*   The results are re-sorted in memory to match the order of `pageIds`.

---

## Response Structure

```typescript
export type ChunkPaginationData<T> = {
  data: T[]; // The actual 20 items for the UI
  metadata: {
    nextChunkId: string | null; // Pointer to the start of the NEXT 2000 items
    
    chunkSize: number;       // e.g., 2000
    chunkTotalItems: number; // How many items are actually in this chunk (e.g., 1543)

    limit: number;  // Echoed
    offset: number; // Echoed
  };
};
```

## Frontend Guide

### Standard Pagination (Next Page)
Increment the `offset`.
*   **Page 1:** `offset: 0`
*   **Page 2:** `offset: 20`
*   **Constraint:** `offset + limit` must not exceed `chunkSize` (2000).

### Chunk Navigation (Next Segment)
When the user reaches the end of the current chunk (e.g., Page 100):
1.  Check `metadata.nextChunkId`.
2.  If present, request `offset: 0` with `chunkId: metadata.nextChunkId`.
3.  Reset local page count to 1.