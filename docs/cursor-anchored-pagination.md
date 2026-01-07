# Cursor-Anchored Pagination (Segmented Window Strategy)

## Overview

This project uses a high-performance **Hybrid Pagination Strategy** designed for scalability. It combines the user-friendly nature of **Offset Pagination** ("Page 1, 2, 3") with the database efficiency of **Cursor Pagination** (Infinite Scroll).

### The Core Problem
1.  **Offset is slow:** `OFFSET 50000` requires the DB to scan and discard 50k rows.
2.  **Cursor is rigid:** `WHERE id < last_id` is fast, but you can't jump to "Page 5".

### The Solution: "Segments"
We break the data into fixed-size windows called **Segments** (e.g., 2,000 items).
*   **The Anchor:** A cursor (Timestamp + ID) that marks the *start* of a segment.
*   **The Offset:** Within a segment, we use standard `OFFSET` (0-1999). This is fast because the offset is bounded.
*   **The Navigation:** To see item #2001, we switch to a **New Anchor**.

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
We run two parallel queries to map the segment and fetch the user's data.

#### Step A: Resolve Anchor
If an `anchorId` is provided, we fetch its `createdAt` timestamp to enable a precise cursor comparison.

*   **NEXT (Forward):** `WHERE (created_at, id) <= (anchor_date, anchor_id)`
*   **PREVIOUS (Backward):** `WHERE (created_at, id) > (anchor_date, anchor_id)`

#### Step B: Parallel Execution
1.  **Segment Map (Lightweight):** Fetch the IDs of the next 2,001 items.
    *   *Purpose:* Calculates accurate `segmentItemCount` (e.g., "Page 1 of 42") and finds the `nextAnchorId`.
2.  **Data Fetch (Targeted):** Fetch only the `limit` (20) rows requested.
    *   *Purpose:* Returns the actual user data.

---

## Response Structure

```typescript
interface AnchorSegmentPaginationData {
  data: T[];
  metadata: {
    // The anchor used for this view. (Save this!)
    currentAnchorId: string; 
    
    // The anchor to use if the user clicks "Next Segment"
    nextAnchorId: string | null; 
    
    // Total items in this specific segment (Max: 2000)
    segmentItemCount: number; 
    
    // Configured max size
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
*   **Page 5:** `offset: 80`
*   *Invariant:* `offset` must never exceed `segmentSize` (2000).

### 2. Navigation (Next Segment)
When the user reaches the end of the segment (Page 100), check `metadata.nextAnchorId`.
*   **Action:** Request `page: 1` (`offset: 0`) using `anchorId: nextAnchorId`.
*   **State:** Push the *old* `currentAnchorId` to a local **History Stack**.

### 3. Navigation (Previous Segment)
Do **NOT** ask the backend for "Previous Segment ID".
*   **Action:** Pop the last anchor from your **History Stack**.
*   **Request:** `page: 1` (`offset: 0`) using the popped anchor.

### 4. Deep Linking (Limitations)
If a user lands directly on `?anchorId=xyz`, they are "parachuted" into the list.
*   **Can they go Forward?** Yes (`nextAnchorId` is provided).
*   **Can they go Back?** No. The history stack is empty.
    *   *Solution:* Provide a "Back to Start" button (Link to `anchorId=null`).

---

## Pros & Cons

### ✅ Pros
1.  **O(1) Performance:** Loading Page 10,000 is as fast as Page 1.
2.  **UX:** Users get "Page Numbers" (1-100) unlike standard infinite scroll.
3.  **Safety:** Hard limits prevent "Deep Offset" attacks.

### ⚠️ Cons
1.  **Client State:** Frontend must track the History Stack for optimal "Back" navigation.
2.  **Approximate Totals:** We don't show "Total 50,000 items". We show "2,000 items available" and reveal more as they go.