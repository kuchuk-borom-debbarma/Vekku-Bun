import type { IContentTagSuggestionService } from "./ContentTagSuggestionService";
import { ContentTagSuggestionServiceImpl } from "./ContentTagSuggestionServiceImpl";
import { initSuggestionListeners } from "./Listeners";

export const getContentTagSuggestionService = (): IContentTagSuggestionService => {
  return new ContentTagSuggestionServiceImpl();
};

export { initSuggestionListeners };