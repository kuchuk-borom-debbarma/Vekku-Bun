import type { UserTag } from "../tags/TagService";

export type ContentTagSuggestion = {
  id: string;
  tag: UserTag;
  score: string;
};

export interface IContentTagSuggestionService {
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

  /**
   * get suggested tags of a content
   */
  getSuggestionsForContent(
    contentId: string,
    userId: string,
  ): Promise<ContentTagSuggestion[]>;

  extractKeywords(content: string): Promise<string[]>;
}
