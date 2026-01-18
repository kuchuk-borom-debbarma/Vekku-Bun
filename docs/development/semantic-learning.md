# User-Adaptive Semantic Learning

## Overview

This document outlines the strategy for implementing **User-Adaptive Semantic Learning** in the tagging system. The goal is to move from purely *static* dictionary definitions of tags to *contextual* user-specific definitions.

If a user consistently uses the tag "GGEZ" on content about "Gaming" or "High Performance," the system should learn this association, even if the global dictionary definition of "GGEZ" is unknown or unrelated.

## Core Strategy: Passive Gap Filling

To keep the system efficient and focused, we will employ a **Passive Gap Filling** strategy. We do not need to reinforce connections the system already understands. We only need to learn when the system *misses* a connection.

### The Rule
When a user tags a piece of content:

1.  **Check Suggestions:** Did the system suggest this tag for this content?
    *   **YES:** Do nothing. The system's current understanding is sufficient.
    *   **NO:** **Trigger Learning.** The user made a connection the system missed. We need to update the tag's context vector.

## Technical Implementation

### 1. Mathematical Model: Centroid-Based Drift

We treat a user's usage of a tag as a cluster of vectors. The "meaning" of the tag for that user is the **Centroid** (geometric center) of all content bodies where they applied that tag manually.

To update this efficiently without re-scanning history, we use the **Cumulative Moving Average** formula:

**Formula:**
New_Average = ((Old_Average * Usage_Count) + New_Content_Vector) / (Usage_Count + 1)

*   **New_Average**: The new stored context vector.
*   **Old_Average**: The current stored context vector (starts at 0).
*   **Usage_Count**: The number of times this tag has been learned so far.
*   **New_Content_Vector**: The embedding vector of the content currently being tagged.

### 2. Database Schema Changes

We need to store the learned context directly on the link between the user and the tag.

**Table:** `user_tags`

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `context_embedding` | `vector(1024)` | `NULL` | The learned centroid of the tag's context for this user. |
| `usage_count` | `integer` | `0` | The denominator for the moving average calculation. |
| `last_learned_at` | `timestamp` | `NULL` | Metadata to track when the last update occurred. |

### 3. Execution Flow

#### Step 1: Content Interaction
User creates or updates content. The `ContentService` generates the `content_embedding`.

#### Step 2: Tag Application
The user applies a tag (e.g., "GGEZ").

#### Step 3: Learning Trigger
The `TagService` receives the `addTag` request. It checks if the tag was already suggested.
```typescript
const suggestions = await suggestionService.getSuggestionsForContent(contentId);
const isSuggested = suggestions.some(s => s.tagId === tagId);

if (!isSuggested) {
  // The system missed this. LEARN IT.
  await tagService.reinforceTag(tagId, contentEmbedding);
}
```

#### Step 4: Reinforcement
The `reinforceTag` function performs the mathematical update:
1.  Fetch `context_embedding` and `usage_count` from `user_tags`.
2.  Calculate the new weighted average vector using the Moving Average formula.
3.  Update `user_tags` with the new vector and increment `usage_count`.