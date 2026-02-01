# Refactor: SLM-Only Tag Suggestions

## Overview
This document outlines the plan to refactor the tag suggestion system to remove all vector embedding dependencies and rely entirely on a Small Language Model (SLM) for keyword extraction and tag matching.

**Core Goals:**
1.  **Remove Vector Embeddings:** Eliminate `tag_embeddings` and `content_embeddings` logic. No more "learning" phase.
2.  **Database Caching:** Store suggestions in the database to prevent redundant AI calls.
3.  **Manual Regeneration:** Suggestions are generated only on demand (first fetch) or via explicit user regeneration.
4.  **Strict Lifecycle Management:** Ensure suggestions stay consistent when tags or content are deleted.

## 1. Database Schema Changes

### A. New Table: `content_suggestions`
We will use a JSONB approach for flexibility and simplicity, coupled with runtime validation.

```typescript
export const contentSuggestions = pgTable("content_suggestions", {
  id: varchar({ length: 255 }).primaryKey(),
  contentId: varchar("fk_content_id", { length: 255 })
    .notNull()
    .references(() => contents.id, { onDelete: "cascade" }) // Auto-delete on content deletion
    .unique(), // One suggestion set per content
  data: jsonb("data").$type<{
    existing: { tagId: string; name: string; score: number }[];
    potential: { keyword: string; score: number }[];
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});
```

### B. Cleanup
*   **Deprecate/Remove:** `tag_embeddings` table and usage.
*   **Deprecate/Remove:** `content_embeddings` table and usage.
*   **Remove:** `embedding` column from `tag_embeddings` if keeping the table for other reasons (or just drop the table).

## 2. API Endpoints

### A. GET `/api/suggestions/content/:contentId`
**Logic:**
1.  **Check DB:** Query `content_suggestions` for the given `contentId`.
2.  **Hit:**
    *   **Runtime Filter:** Fetch the user's current valid `userTags`. Filter the stored `existing` suggestions to ensure all `tagId`s still exist. (Handles the "Delete Tag" requirement).
    *   Return filtered result.
3.  **Miss:**
    *   **Trigger AI:** Call SLM to extract keywords.
    *   **Match:** Match extracted keywords against current `userTags` (string matching).
    *   **Store:** Save result to `content_suggestions`.
    *   Return result.

### B. POST `/api/suggestions/content/:contentId/regenerate`
**Rate Limit:** 5 requests per 1 minute per user.

**Logic:**
1.  **Trigger AI:** Call SLM to analyze the content and extract new keywords.
2.  **Match:** Match against current `userTags`.
3.  **Upsert:** Update `content_suggestions` with the new data.
4.  Return new result.

## 3. Logic & Algorithms

### A. SLM Prompting
We will use a focused prompt to get structured data.

```text
Analyze the following text.
1. Identify the most relevant topics, themes, and entities.
2. Return a JSON object with a list of "keywords" (strings) and their relevance "score" (0.0-1.0).
3. Be precise and avoid generic terms.
TEXT: ...
```

### B. Matching Logic (The "Linker")
Since we lack embeddings, we match strings.
1.  **Normalize:** Lowercase, trim.
2.  **Fetch User Tags:** `SELECT * FROM userTags WHERE userId = ?`.
3.  **Comparison:**
    *   Iterate through AI keywords.
    *   Check if `normalize(ai_keyword) === normalize(user_tag.name)` or `user_tag.semantic`.
    *   If Match: Add to `existing`.
    *   If No Match: Add to `potential`.

## 4. Lifecycle & Edge Cases

### A. Content Deletion
*   **Handled by DB:** `ON DELETE CASCADE` on `content_suggestions.contentId` ensures suggestions are wiped when content is deleted.

### B. Tag Deletion
*   **Scenario:** User deletes a tag "React".
*   **Storage State:** `content_suggestions` still has `{ tagId: "xyz", name: "React" }`.
*   **Resolution:**
    *   We do **not** eagerly update all JSON blobs (too expensive).
    *   **Runtime Sanitization:** On `GET /suggestions`, we cross-reference the `tagId`s in the JSON with the actual `userTags` table. If a tag ID no longer exists, it is dropped from the response.

### C. Content Update
*   **Action:** Do nothing.
*   **Reasoning:** User might have manually curated suggestions or is happy with old ones. We only regenerate on explicit request.

### D. Empty Content
*   If content body is empty/too short, return empty suggestions without hitting AI.

### E. AI Failure
*   If SLM fails (timeout/error):
    *   On `GET` (Miss): Return 503 or empty suggestions with error flag.
    *   On `Regenerate`: Return 503.

## 5. Implementation Steps
1.  **Schema:** Create migration for `content_suggestions`.
2.  **Service:** Rewrite `ContentTagSuggestionService`.
    *   Implement `generateSuggestions(content, userTags)`.
    *   Implement `getSuggestions` (DB + Runtime Filter).
    *   Implement `regenerateSuggestions`.
3.  **Routes:** Update `GET` and add `POST /regenerate` with Rate Limiting.
4.  **Cleanup:** Remove embedding code.
