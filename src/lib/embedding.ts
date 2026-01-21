export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

let embeddingConfig: { accountId?: string; apiKey?: string } = {};

export const setEmbeddingConfig = (config: {
  accountId?: string;
  apiKey?: string;
}) => {
  embeddingConfig = config;
};

const localEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    console.warn(
      "[Embedding] WARNING: Using Local Dummy Embedding Service (Fixed Non-Zero Vectors). " +
        "Set CLOUDFLARE_WORKER_ACCOUNT_ID and CLOUDFLARE_WORKER_AI_API_KEY to use real embeddings.",
    );
    // Return a valid non-zero vector of dimension 1024 to match DB schema (bge-m3).
    // Zero vectors cause "division by zero" errors in pgvector cosine distance calculations.
    // We set the first element to 1 to ensure magnitude is 1.
    const vec = new Array(1024).fill(0);
    vec[0] = 1;
    return vec;
  },
};

const cloudflareEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    const accountId = embeddingConfig.accountId;
    const apiKey = embeddingConfig.apiKey;

    if (!accountId || !apiKey) {
      throw new Error(
        "Cloudflare credentials (ACCOUNT_ID or API_KEY) are missing.",
      );
    }

    const model = "@cf/baai/bge-m3";
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
  const hasCloudflareCreds =
    embeddingConfig.accountId && embeddingConfig.apiKey;

  if (env?.WORKER || hasCloudflareCreds) {
    return cloudflareEmbeddingService;
  }

  return localEmbeddingService;
};
