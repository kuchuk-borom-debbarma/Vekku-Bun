export type ContentSuggestion = {
  id: string;
  tagId: string;
  name: string;
  score: string;
};

export interface ITagSuggestionService {
  learnTag(semantic: string): Promise<string>;

  createSuggestionsForContent(data: {
    content: string;
    contentId: string;
    userId: string;
    suggestionsCount: number;
    threshold: number;
  }): Promise<void>;

  getSuggestionsForContent(contentId: string): Promise<ContentSuggestion[]>;
}