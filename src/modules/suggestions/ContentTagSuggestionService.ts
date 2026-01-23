import type { UserTag } from "../tags/TagService";

export type ExistingSuggestion = {
  tagId: string;
  name: string;
  score: string;
};

export type PotentialSuggestion = {
  keyword: string;
  score: string;
  variants: string[];
};

export type ContentSuggestions = {
  existing: ExistingSuggestion[];
  potential: PotentialSuggestion[];
};

export type ContentTagSuggestion = {
  id: string;
  tag: UserTag;
  score: string;
};

export interface IContentTagSuggestionService {
  ensureConceptExists(semantic: string): Promise<string>;
  learnTags(semantics: string[]): Promise<string[]>;
  createSuggestionsForContent(data: {
    content: string;
    contentId?: string;
    userId: string;
    suggestionsCount: number;
    mode?: "tags" | "keywords" | "both";
  }): Promise<ContentSuggestions>;

  /**
   * Get suggested tags and potential keywords for a piece of content (Cache only)
   */
  getSuggestionsForContent(
    contentId: string | undefined,
    userId: string,
    mode?: "tags" | "keywords" | "both",
    text?: string,
  ): Promise<ContentSuggestions | null>;

  extractKeywords(content: string): Promise<{ word: string; score: number }[]>;
}
