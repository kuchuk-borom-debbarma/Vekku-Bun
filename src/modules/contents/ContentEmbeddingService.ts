import type { Content } from "./ContentService";

export interface IContentEmbeddingService {
  generateAndSaveEmbedding(content: Content): Promise<void>;
  searchContent(userId: string, query: string, limit?: number, offset?: number): Promise<Content[]>;
}
