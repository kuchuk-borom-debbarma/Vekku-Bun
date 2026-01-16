import type { AppEvent, EventHandler, IEventBus } from "./EventBus";

/**
 * A simple in-memory event bus implementation.
 * Suitable for local development and simple serverless triggers.
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  async publish<T>(
    topic: string, 
    payload: T, 
    userId?: string, 
    ctx?: { waitUntil: (promise: Promise<any>) => void }
  ): Promise<void> {
    const event: AppEvent<T> = {
      topic,
      payload,
      timestamp: Date.now(),
      userId,
    };

    const topicHandlers = this.handlers.get(topic) || [];
    
    // Create a promise that executes all handlers
    const executionPromise = Promise.all(
      topicHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`[EventBus] Error in handler for topic "${topic}":`, error);
        }
      })
    );

    // If an execution context is provided (Cloudflare Workers), use waitUntil
    if (ctx) {
      ctx.waitUntil(executionPromise);
      return; // Return immediately
    }

    // Otherwise, we await it (standard Node/Bun behavior or if caller wants to wait)
    await executionPromise;
  }

  subscribe<T>(topic: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler as EventHandler);
  }
}
