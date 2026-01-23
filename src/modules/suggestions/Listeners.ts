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
