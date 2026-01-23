# AI Suggestions System (On-Demand & Cache-First)

## Overview

Vekku-Bun uses a hybrid AI approach to suggest tags. It combines **Vector Semantic Search** (matching existing user tags) and **KeyBERT Keyword Extraction** (proposing new potential tags).

To optimize performance and minimize costs associated with AI embedding generation, the system uses a **Cache-First, On-Demand** architecture.

## Architecture

### 1. Unified Suggestion Engine

Instead of running suggestions automatically in the background, suggestions are generated only when requested via the UI.

*   **Existing Tag Matching:** Uses `pgvector` to compare the content embedding against the user's existing tags.
*   **Keyword Extraction:** Uses a KeyBERT-like algorithm to find high-relevance phrases within the content itself that aren't yet tags.

### 2. Cache-First Strategy (Redis)

Suggestions are **never persisted in the primary database** (PostgreSQL). Instead, they are stored exclusively in **Upstash Redis**.

*   **Workflow (`POST /api/suggestions/generate`):**
    1.  **Check Cache:** If suggestions for this `contentId` exist in Redis, return them immediately.
    2.  **Bypass Rate Limit:** Cache hits bypass the strict AI rate limit.
    3.  **Cache Miss:** If not cached (or for new unsaved content), the system enforces a strict **AI Rate Limit**.
    4.  **Generation:** If within limits, generate embeddings, perform vector search + KeyBERT extraction.
    5.  **Persistence:** Store results in Redis with a TTL.

### 3. Strict Rate Limiting

Because AI embedding generation is computationally expensive and potentially costly (API calls to Cloudflare AI), we enforce a specialized limiter:

*   **Standard Rate Limit:** 10 requests / 10 seconds (Global API).
*   **AI Rate Limit:** **3 requests / 1 minute** (Specific to suggestion generation on cache miss).

## Data Flow

### Suggestion Retrieval (`GET /api/suggestions/content/:id`)
- Simple Redis lookup by `contentId`.
- Fast, O(1) complexity.
- Returns `{ existing: [], potential: [] }`.

### Suggestion Generation (`POST /api/suggestions/generate`)
- Body: `{ contentId?: string, text?: string }`.
- Logic:
    1.  **Extract Candidates:** Generate N-grams (1-2 words) from text.
    2.  **Filter:** Remove stopwords and low-frequency terms.
    3.  **Batch Embed:** Call Cloudflare AI once for `[ContentBody, ...Candidates]`.
    4.  **Vector Search:** Compare Content Embedding against `tag_embeddings` in DB.
    5.  **Keyword Ranking:** Calculate Cosine Similarity between Content Embedding and Candidate Embeddings.
    6.  **Merge & Dedup:** Combine results, ensuring potential keywords don't overlap with matched existing tags.

## Performance Optimizations

1.  **Parallel Execution:** Main content embedding and keyword extraction run in parallel.
2.  **Batch Embedding:** All candidate words for KeyBERT are sent to the AI model in a single batch request.
3.  **Zero-Scan Counters:** Dashboard stats use a `metadata` JSONB counter in the `users` table to avoid `COUNT(*)` scans.
4.  **No-DB Suggestions:** Removing suggestions from Postgres reduces write amplification and table bloat.
