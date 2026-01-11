import type { ITagSuggestionService } from "./TagSuggestionService";
import { TagSuggestionServiceImpl } from "./TagSuggestionServiceImpl";

export const getTagSuggestionService = (): ITagSuggestionService => {
  return new TagSuggestionServiceImpl();
};
