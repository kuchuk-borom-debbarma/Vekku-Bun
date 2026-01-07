# Cursor-Anchored Pagination (Bi-Directional Segment Strategy)

## Overview

This project uses a high-performance **Hybrid Pagination Strategy** designed for scalability and stateless navigation. It combines the user-friendly nature of **Offset Pagination** ("Page 1, 2, 3") with the database efficiency of **Cursor Pagination** (Infinite Scroll).

### The Core Problem
1.  **Offset is slow:** `OFFSET 50000` requires the DB to scan and discard 50k rows.
2.  **Cursor is rigid:** `WHERE id < last_id` is fast, but you can't jump to "Page 5".
3.  **Stateful Back:** Usually, cursor pagination requires the frontend to remember history to go "Back".

### The Solution: "Segments"
We break the data into fixed-size windows called **Segments** (e.g., 2,000 items).
*   **The Anchor:** A cursor (Timestamp + ID) that marks the *start* of a segment.
*   **The Offset:** Within a segment, we use standard `OFFSET` (0-1999). This is fast because the offset is bounded.
*   **Stateless Navigation:** The backend calculates both `nextAnchorId` AND `prevAnchorId` on every request, allowing deep linking and full traversal without client history.

---

## Technical Implementation

### 1. The Request
The frontend requests a specific page *relative* to a known anchor.

```typescript
interface PaginationRequest {
  limit: number;           // Items per page (e.g., 20)
  offset: number;          // Skip relative to anchor (e.g., 80 = Page 5)
  anchorId?: string;       // The ID starting this segment (null = Start)
  direction: 'NEXT' | 'PREVIOUS'; // Are we looking Forward or Backward?
}
```

### 2. The Database Logic
We run **three parallel queries** to map the territory.

#### Query A: Forward Map (Next Segment)
Fetches IDs of the next 2,001 items (descending).
*   Determines `segmentItemCount`.
*   Finds `nextAnchorId`.

#### Query B: Backward Map (Previous Segment)
Fetches IDs of the *previous* 2,000 items (ascending).
*   *Condition:* Only runs if `anchorId` is present.
*   Finds `prevAnchorId` (the start of the previous block).

#### Query C: Data Fetch
Fetches the actual `limit` (20) rows requested for the UI.

---

## Response Structure

```typescript
interface AnchorSegmentPaginationData {
  data: T[];
  metadata: {
    currentAnchorId: string; 
    nextAnchorId: string | null; // Forward pointer
    prevAnchorId: string | null; // Backward pointer (New!)
    
    segmentItemCount: number;    // Items in current segment
    segmentSize: number; 
  };
}
```

---

## Frontend Integration Guide

### 1. Navigation (Next/Prev Page)
Just change the `offset`.
*   **Page 1:** `offset: 0`
*   **Page 2:** `offset: 20`
*   *Invariant:* `offset` must never exceed `segmentSize` (2000).

### 2. Navigation (Next Segment)
When user hits end of segment (Page 100):
*   **Action:** Request `page: 1` (`offset: 0`) using `anchorId: metadata.nextAnchorId`.

### 3. Navigation (Previous Segment)
When user hits start of segment (Page 1) and wants to go back:
*   **Action:** Request `page: 1` (`offset: 0`) using `anchorId: metadata.prevAnchorId`.
*   *Note:* No history stack needed!

---

## Pros & Cons

### ✅ Pros
1.  **Stateless:** Deep link to any segment and still go "Back".
2.  **O(1) Performance:** Loading Page 10,000 is as fast as Page 1.
3.  **UX:** Users get "Page Numbers" (1-100).
4.  **Safety:** Hard limits prevent "Deep Offset" attacks.

### ⚠️ Cons
1.  **DB Load:** We run 3 queries instead of 1. However, 2 of them are lightweight index scans.
2.  **Approximate Totals:** We don't show "Total 50,000 items", only the local count.
