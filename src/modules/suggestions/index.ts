import type { ITagSuggestionService } from "./TagSuggestionService";
import { TagSuggestionServiceImpl } from "./TagSuggestionServiceImpl";
import { initSuggestionListeners } from "./Listeners";

export const getTagSuggestionService = (): ITagSuggestionService => {
  return new TagSuggestionServiceImpl();
};

export { initSuggestionListeners };
