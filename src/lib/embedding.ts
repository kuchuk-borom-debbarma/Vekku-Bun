import { pipeline } from "@xenova/transformers";
export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

const localEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    return [0];
  },
};

const cloudflareEmbeddingService: IEmbeddingService = {
  generateEmbedding: function (text: string): Promise<number[]> {
    throw new Error("Function not implemented.");
  },
};
