import type { IEventBus } from "./EventBus";
import { InMemoryEventBus } from "./InMemoryEventBus";

let eventBus: IEventBus | null = null;

/**
 * Singleton getter for the EventBus.
 * Implementation can be swapped here (e.g., Cloudflare Queues).
 */
export const getEventBus = (): IEventBus => {
  if (!eventBus) {
    eventBus = new InMemoryEventBus();
  }
  return eventBus;
};

export * from "./EventBus";
export * from "./Topics";
