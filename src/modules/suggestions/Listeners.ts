import { getEventBus, TOPICS, type AppEvent } from "../../lib/events";
import { getContentTagSuggestionService } from "./index";
import type { Content } from "../contents/ContentService";
import type { UserTag } from "../tags/TagService";

/**
 * Initializes listeners for the Suggestions module.
 * This decouples the Suggestions logic from the Content module.
 */
export const initSuggestionListeners = () => {
  const eventBus = getEventBus();
  const suggestionService = getContentTagSuggestionService();

  // Handle Content Created -> Generate Suggestions
  eventBus.subscribe(TOPICS.CONTENT.CREATED, async (event: AppEvent<Content>) => {
    const content = event.payload;
    
    // In a real app, these might come from a config service or env
    const matchCount = 20;

    try {
      await suggestionService.createSuggestionsForContent({
        content: content.body,
        contentId: content.id,
        userId: content.userId,
        suggestionsCount: matchCount,
      });
    } catch (error) {
      console.error(`[SuggestionListener] Failed to generate suggestions for content ${content.id}:`, error);
    }
  });

  // Handle Content Updated -> Regenerate Suggestions
  eventBus.subscribe(TOPICS.CONTENT.UPDATED, async (event: AppEvent<Content>) => {
    const content = event.payload;
    
    const matchCount = 20;

    try {
      await suggestionService.createSuggestionsForContent({
        content: content.body,
        contentId: content.id,
        userId: content.userId,
        suggestionsCount: matchCount,
      });
    } catch (error) {
      console.error(`[SuggestionListener] Failed to regenerate suggestions for content ${content.id}:`, error);
    }
  });

  // Handle Tag Created -> Learn Semantic (Generate Embedding)
  eventBus.subscribe(TOPICS.TAG.CREATED, async (event: AppEvent<UserTag>) => {
    const tag = event.payload;
    try {
      // This will generate the embedding and update the concept record
      await suggestionService.learnTags([tag.semantic]);
    } catch (error) {
      console.error(`[SuggestionListener] Failed to learn tag ${tag.name} (${tag.semantic}):`, error);
    }
  });

  // Handle Tag Updated -> Learn Semantic (Generate Embedding)
  eventBus.subscribe(TOPICS.TAG.UPDATED, async (event: AppEvent<UserTag>) => {
    const tag = event.payload;
    try {
      await suggestionService.learnTags([tag.semantic]);
    } catch (error) {
      console.error(`[SuggestionListener] Failed to relearn tag ${tag.name} (${tag.semantic}):`, error);
    }
  });
};
