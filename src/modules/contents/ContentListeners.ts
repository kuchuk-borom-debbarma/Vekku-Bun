import { getEventBus, TOPICS, type AppEvent } from "../../lib/events";
import { getContentEmbeddingService } from "./index";
import type { Content } from "./ContentService";

export const initContentListeners = () => {
  const eventBus = getEventBus();
  const contentEmbeddingService = getContentEmbeddingService();

  const handleContentChange = async (event: AppEvent<Content>) => {
    const content = event.payload;
    try {
      await contentEmbeddingService.generateAndSaveEmbedding(content);
    } catch (error) {
      console.error(
        `[ContentListener] Failed to generate embedding for content ${content.id}:`,
        error,
      );
    }
  };

  eventBus.subscribe(TOPICS.CONTENT.CREATED, handleContentChange);
  eventBus.subscribe(TOPICS.CONTENT.UPDATED, handleContentChange);
};
