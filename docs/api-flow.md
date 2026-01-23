# Vekku-Bun API Flow Documentation

This document provides a detailed overview of the API endpoints, their internal logic, and the data flow within the system.

## Authentication Module

### 1. Request Signup (Stateless)
- **Endpoint:** `POST /auth/signup/request`
- **Logic:** Validates if the user exists, hashes the password, and generates a stateless signup token (JWT).
- **Flow:**
```mermaid
graph TD
    A[Request: Email, Password, Name] --> B{Check User Exists}
    B -- Yes --> C[Return 409 Conflict]
    B -- No --> D[Hash Password]
    D --> E[Generate Stateless Signup Token]
    E --> F[Generate Verification URL]
    F --> G[Send Notification Email]
    G --> H[Return 200 OK: Email Sent]
```

### 2. Verify Signup (Account Creation)
- **Endpoint:** `GET /auth/signup/verify?token=...`
- **Logic:** Verifies the signup token and persists the user in the database.
- **Flow Chart:**
```mermaid
graph TD
    A[Verification Token] --> B{Verify Token}
    B -- Invalid/Expired --> C[Return 400 Error]
    B -- Valid --> D[Extract User Details from Token]
    D --> E[Insert User into Database]
    E --> F[Return 200 OK: User Created]
```

### 3. Login
- **Endpoint:** `POST /auth/login`
- **Logic:** Verifies credentials and returns Access/Refresh tokens.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: Email, Password] --> B[Fetch User by Email]
    B --> C{User Found?}
    C -- No --> D[Return 401 Unauthorized]
    C -- Yes --> E{Verify Password Hash}
    E -- No --> D
    E -- Yes --> F[Generate Access Token & Refresh Token]
    F --> G[Update User Metadata: login timestamps]
    G --> H[Return tokens]
```

---

## Tag Management Module

### 1. Create Tag(s)
- **Endpoint:** `POST /api/tag`
- **Logic:** Batch creates tags for a user. Atomic metadata updates and event-driven learning.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: { tags: [...] }] --> B[Normalize Semantic Names]
    B --> C[Batch Insert into Database]
    C --> D{New Tags Inserted?}
    D -- Yes --> E[Atomic Metadata Update: Increment tagCount]
    D -- No/Update --> F[Invalidate Redis Cache: tags:list:userId:*]
    E --> F
    F --> G[Invalidate Redis Cache: suggestions:*:userId:*]
    G --> H[Publish TAG.CREATED Event per tag]
    H --> I[Return 201 Created]
    H -.-> J[Background: Listener generates embeddings]
```

### 2. Search Tags (Fuzzy)
- **Endpoint:** `GET /api/tag?q=...`
- **Logic:** Uses ParadeDB `pg_search` (BM25) for high-performance fuzzy matching.
- **Flow Chart:**
```mermaid
graph TD
    A[Query String] --> B{Query Empty?}
    B -- Yes --> C[Return Empty List]
    B -- No --> D[Build 3-Tier Fuzzy Search Conditions]
    D --> E[Execute pg_search Query]
    E --> F[Map Scores and Results]
    F --> G[Return Results with Metadata]
```

---

## Content Module

### 1. Create Content
- **Endpoint:** `POST /api/content`
- **Logic:** Persists content, links tags, updates counters, and triggers auto-learning.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: Title, Body, Type, tagIds] --> B[Insert Content to DB]
    B --> C[Atomic Metadata Update: Increment contentCount]
    C --> D[Link Provided Tag IDs]
    D --> E[Invalidate Redis Cache: contents:list:userId:*]
    E --> F[Publish CONTENT.CREATED Event]
    F --> G[Return 201 Created]
```

### 2. Get Contents by Tags
- **Endpoint:** `GET /api/content/by-tags?tagIds=...`
- **Logic:** AND-logic filtering. Finds content containing ALL specified tags. Uses standard chunked pagination.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: tagIds, chunkId, offset] --> B[Resolve Chunk Cursor]
    B --> C[Identify matching Content IDs via content_tags]
    C --> D[Group by Content ID & Apply Having count = tagIds.length]
    D --> E[Slice Chunk IDs for Page]
    E --> F[Fetch Full Content Data]
    F --> G[Return Page + nextChunkId]
```

---

## AI Suggestions Module

### 1. Generate Suggestions
- **Endpoint:** `POST /api/suggestions/generate`
- **Logic:** Cache-first, on-demand AI matching and keyword extraction.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: contentId OR text, mode] --> B{Check Redis Cache}
    B -- HIT --> C[Return Cached Results]
    B -- MISS --> D[Enforce AI Rate Limit: user.id:mode]
    D -- Over Limit --> E[Return 429 Too Many Requests]
    D -- Within Limit --> F[Identify Content Text]
    F --> G[Generate Content Embedding]
    G --> H[Run Matched Tags Search & KeyBERT Extraction in Parallel]
    H --> I[Normalize and Score Results: lower distance is better]
    I --> J[Store in Redis: TTL 24h for Content, 10m for TextHash]
    J --> K[Return Results]
```

### 2. Learn Tags (Manual Relearn)
- **Endpoint:** `POST /api/suggestions/tags/relearn`
- **Logic:** Forces vector generation for existing tags.
- **Flow Chart:**
```mermaid
graph TD
    A[Request: tagIds] --> B[Fetch semantic strings for IDs]
    B --> C[Batch Generate Embeddings via Cloudflare AI]
    C --> D[Update tag_embeddings table]
    D --> E[Return Status]
```

---

## Stats Module

### 1. Dashboard Stats
- **Endpoint:** `GET /api/stats`
- **Logic:** O(1) retrieval from user metadata. No table scans.
- **Flow Chart:**
```mermaid
graph TD
    A[Request] --> B[Verify JWT]
    B --> C[Fetch 'metadata' JSONB column for user]
    C --> D[Return contentCount & tagCount]
```
