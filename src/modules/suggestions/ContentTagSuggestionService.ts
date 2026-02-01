export type ExistingSuggestion = {
  tagId: string;
  name: string;
  score: number;
};

export type PotentialSuggestion = {
  keyword: string;
  score: number;
  variants: string[];
};

export type ContentSuggestions = {
  existing: ExistingSuggestion[];
  potential: PotentialSuggestion[];
};

export interface IContentTagSuggestionService {
  /**
   * Get suggestions for a piece of content.
   * Checks the database first. If missing, generates using AI and saves.
   * Performs runtime filtering to ensure existing tags are still valid.
   */
  getSuggestionsForContent(
    contentId: string,
    userId: string
  ): Promise<ContentSuggestions>;

  /**
   * Force regenerate suggestions using AI and update the DB.
   */
  regenerateSuggestionsForContent(
    contentId: string,
    userId: string
  ): Promise<ContentSuggestions>;

  /**
   * Extract raw keywords from text (Stateless).
   */
  extractKeywords(content: string): Promise<{ word: string; score: number }[]>;
}