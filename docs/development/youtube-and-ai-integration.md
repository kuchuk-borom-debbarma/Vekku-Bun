# YouTube Content & AI Suggestion System

This document outlines the architecture and implementation details of the YouTube content integration and the context-aware AI suggestion engine.

## 1. YouTube Content Flow

Due to aggressive IP blocking by YouTube on serverless environments (Cloudflare Workers), we utilize a **Manual-Assist Transcription Flow**.

### Flow Steps:
1.  **URL Input**: User enters a YouTube URL.
2.  **Auto-Metadata**: The frontend automatically fetches the video title via YouTube's OEmbed API (browser-side) or a lightweight backend proxy.
3.  **Manual Transcription**: 
    *   The UI provides a list of "Transcript Tools" (Tactiq, YouTube-Transcript.io, etc.).
    *   A helper site is opened in a new tab.
    *   The user copies the transcript and pastes it into the "Step 2: Provide Transcript" section.
4.  **Content Storage**: The content is saved with the transcript in the `metadata` JSONB column, while the primary `body` remains the user-provided title/description.

---

## 2. AI Suggestion Engine

The system uses a hybrid approach to extract tags and keywords, prioritizing intelligence while maintaining high performance.

### Extraction Hierarchy:
1.  **SLM Extraction (Primary)**: 
    *   Uses Cloudflare Workers AI with the **`phi-3-mini-4k-instruct`** model.
    *   The model "reads" the content (Title + Description + Transcript) and extracts up to 10 distinct technical concepts.
    *   **Benefit**: Understands complex entities (e.g., "Load Balancer") as single tags rather than fragmented words.
2.  **N-gram Fallback (Secondary)**: 
    *   If AI is unavailable or the content is too short, the system falls back to a custom N-gram extractor ([1, 3] range).
    *   Includes aggressive stopword filtering and sub-phrase suppression (e.g., if "Load Balancer" is found, "Load" is hidden).

### Semantic Logic:
*   **Existing Tags**: The system generates an embedding for the content and performs a vector distance search (`pgvector`) against the user's current tag library.
*   **New Tags**: Extracted keywords are also embedded and checked for "Semantic Collisions." If a keyword is too close to an existing tag, it is suppressed to prevent redundancy.

---

## 3. Performance & Protection

AI extraction is resource-intensive. We use a "Cache-First" tiered strategy.

### Caching:
*   **Mechanism**: SHA-256 hashing of the analyzed text.
*   **Storage**: Upstash Redis (24-hour TTL).
*   **Result**: Identical content (or re-opened modals) returns results instantly without hitting the AI.

### Tiered Rate Limiting:
*   **Global Limit**: 10 requests per 10 seconds (standard API protection).
*   **AI Limit (Cache Miss)**: 3 requests per minute per user.
*   **Logic**: If a request hits the cache, the AI limit is **skipped**. Only "fresh" extractions count against the 3/min quota.

---

## 4. UI/UX Implementation

*   **View Mode**: YouTube content renders a specialized "Link Card" instead of raw text. The transcript is hidden from view but used for background processing.
*   **Edit Mode**: The content type is locked to `YOUTUBE_VIDEO` during editing to preserve the specialized metadata structure.
*   **Creation Modal**: A 3-step wizard handles the URL -> Transcript -> Tag Selection sequence seamlessly.
