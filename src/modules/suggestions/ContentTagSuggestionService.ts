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
  getSuggestionsForContent(
    contentId: string,
    userId: string
  ): Promise<ContentSuggestions>;

  regenerateSuggestionsForContent(
    contentId: string,
    userId: string
  ): Promise<ContentSuggestions>;

  generateSuggestionsForText(
    text: string,
    userId: string
  ): Promise<ContentSuggestions>;

  extractKeywords(content: string): Promise<{ word: string; score: number }[]>;
}
