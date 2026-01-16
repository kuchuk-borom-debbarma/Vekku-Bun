import { getEventBus, TOPICS, type AppEvent } from "../../lib/events";
import { getTagSuggestionService } from "./index";
import type { Content } from "../contents/ContentService";

/**
 * Initializes listeners for the Suggestions module.
 * This decouples the Suggestions logic from the Content module.
 */
export const initSuggestionListeners = () => {
  const eventBus = getEventBus();
  const suggestionService = getTagSuggestionService();

  // Handle Content Created -> Generate Suggestions
  eventBus.subscribe(TOPICS.CONTENT.CREATED, async (event: AppEvent<Content>) => {
    const content = event.payload;
    
    // In a real app, these might come from a config service or env
    const threshold = 0.4;
    const matchCount = 20;

    try {
      await suggestionService.createSuggestionsForContent({
        content: content.body,
        contentId: content.id,
        userId: content.userId,
        suggestionsCount: matchCount,
        threshold: threshold,
      });
    } catch (error) {
      console.error(`[SuggestionListener] Failed to generate suggestions for content ${content.id}:`, error);
    }
  });

  // Handle Content Updated -> Regenerate Suggestions
  eventBus.subscribe(TOPICS.CONTENT.UPDATED, async (event: AppEvent<Content>) => {
    const content = event.payload;
    
    const threshold = 0.4;
    const matchCount = 20;

    try {
      await suggestionService.createSuggestionsForContent({
        content: content.body,
        contentId: content.id,
        userId: content.userId,
        suggestionsCount: matchCount,
        threshold: threshold,
      });
    } catch (error) {
      console.error(`[SuggestionListener] Failed to regenerate suggestions for content ${content.id}:`, error);
    }
  });
};
