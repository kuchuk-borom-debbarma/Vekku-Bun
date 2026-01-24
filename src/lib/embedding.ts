import { getAIService, IAIService, setAIConfig } from "./ai";

export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Backward compatible config setter
 */
export const setEmbeddingConfig = (config: {
  accountId?: string;
  apiKey?: string;
  model?: string;
}) => {
  setAIConfig({
    accountId: config.accountId,
    apiKey: config.apiKey,
    embeddingModel: config.model
  });
};

/**
 * Returns an embedding service that routes to the unified AIService
 */
export const getEmbeddingService = (env?: {
  WORKER?: string;
}): IEmbeddingService => {
  const ai = getAIService(env);
  return {
    generateEmbedding: (text) => ai.generateEmbedding(text),
    generateEmbeddings: (texts) => ai.generateEmbeddings(texts),
  };
};