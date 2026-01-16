# Event-Driven Architecture (EDA)

The application utilizes an Event-Driven Architecture to decouple core domains (like Content) from side-effect domains (like Tag Suggestions). This ensures that heavy operations (e.g., generating embeddings) do not block the main user response loop.

## Core Components

### 1. The Event Bus
We use a lightweight, typed `IEventBus` interface located in `src/lib/events`.

- **Interface:** `IEventBus` defines `publish` and `subscribe`.
- **Implementation:** `InMemoryEventBus` is the current default. It executes handlers asynchronously but provides a mechanism to `await` them if needed.

### 2. Serverless & `waitUntil`
In Cloudflare Workers, background tasks can be killed once the response is returned unless we use `ctx.waitUntil`.

- **Flow:**
    1. A Service (e.g., `ContentService`) publishes an event.
    2. It passes the `ctx` (Execution Context) optionally.
    3. The `InMemoryEventBus` checks for `ctx`.
    4. If `ctx` exists, it calls `ctx.waitUntil(promise)`, allowing the response to return immediately while the background task finishes.
    5. If `ctx` is missing (e.g., local Node/Bun), it behaves like a standard Promise.

### 3. Topics
Topics are centralized in `src/lib/events/Topics.ts` to prevent magic strings.

```typescript
export const TOPICS = {
  CONTENT: {
    CREATED: "content.created",
    UPDATED: "content.updated",
  },
  // ...
};
```

## Usage Pattern

### Publishing an Event

In your service (e.g., `ContentServiceImpl.ts`):

```typescript
import { getEventBus, TOPICS } from "../../lib/events";

// ... inside a method
const eventBus = getEventBus();

// Pass the 'ctx' received from the controller
eventBus.publish(
  TOPICS.CONTENT.CREATED, 
  { id: content.id, ... }, 
  userId, 
  ctx 
);
```

### Subscribing to an Event

In a listener file (e.g., `src/modules/suggestions/Listeners.ts`):

```typescript
export const initSuggestionListeners = () => {
  const eventBus = getEventBus();

  eventBus.subscribe(TOPICS.CONTENT.CREATED, async (event) => {
    // Perform background logic
    await suggestionService.createSuggestionsForContent(event.payload);
  });
};
```

### Initialization
Listeners must be initialized once at application startup. This is done in `src/index.ts`.

```typescript
// src/index.ts
import { initSuggestionListeners } from "./modules/suggestions";

// Initialize global event listeners
initSuggestionListeners();
```
