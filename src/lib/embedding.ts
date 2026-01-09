import { pipeline } from "@xenova/transformers";

export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

const localEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    // Placeholder for local implementation
    return [0];
  },
};

const cloudflareEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    const accountId = process.env.CLOUDFLARE_WORKER_ACCOUNT_ID;
    const apiKey = process.env.CLOUDFLARE_WORKER_AI_API_KEY;

    if (!accountId || !apiKey) {
      throw new Error(
        "Cloudflare credentials (ACCOUNT_ID or API_KEY) are missing.",
      );
    }

    const model = "@cf/baai/bge-small-en-v1.5";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        pooling: "cls", // Recommended for better accuracy
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cloudflare AI API failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as {
      result: { data: number[][] };
      success: boolean;
      errors: any[];
    };

    if (
      !json.success ||
      !json.result ||
      !Array.isArray(json.result.data) ||
      json.result.data.length === 0
    ) {
      console.error("Cloudflare AI Error:", JSON.stringify(json, null, 2));
      throw new Error(
        "Failed to generate embedding: Invalid response from Cloudflare",
      );
    }

    const embedding = json.result.data[0];
    if (!embedding) {
      throw new Error("Failed to generate embedding: Empty data array");
    }

    return embedding;
  },
};

export const getEmbeddingService = (env?: {
  WORKER?: string;
}): IEmbeddingService => {
  // Use Cloudflare service if WORKER env var is present (indicating production/worker env)
  // or if we explicitly want to force it via config.
  // For now, defaulting to local if not specified, similar to hasher.
  return env?.WORKER ? cloudflareEmbeddingService : localEmbeddingService;
};
