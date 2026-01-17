export type ContentSuggestion = {
  id: string;
  tagId: string;
  name: string;
  score: string;
};

export interface ITagSuggestionService {
  learnTag(semantic: string): Promise<string>;
  
  /**
   * Ensures a tag concept exists in the DB, potentially without an embedding.
   * Returns the concept ID.
   */
  ensureConceptExists(semantic: string): Promise<string>;

  createSuggestionsForContent(data: {
    content: string;
    contentId: string;
    userId: string;
    suggestionsCount: number;
  }): Promise<void>;

  getSuggestionsForContent(contentId: string): Promise<ContentSuggestion[]>;
}