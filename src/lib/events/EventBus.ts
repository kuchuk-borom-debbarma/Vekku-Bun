export type AppEvent<T = any> = {
  topic: string;
  payload: T;
  timestamp: number;
  userId?: string;
};

export type EventHandler<T = any> = (event: AppEvent<T>) => Promise<void>;

export interface IEventBus {
  /**
   * Publishes an event to the bus.
   * In serverless, this might just trigger listeners in-memory or send to a queue.
   */
  publish<T>(
    topic: string,
    payload: T,
    userId?: string,
    ctx?: { waitUntil: (promise: Promise<any>) => void }
  ): Promise<void>;

  /**
   * Subscribes a handler to a specific topic.
   */
  subscribe<T>(topic: string, handler: EventHandler<T>): void;
}
