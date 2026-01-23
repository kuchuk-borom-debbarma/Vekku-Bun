export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

let embeddingConfig: { accountId?: string; apiKey?: string; model?: string } = {};

export const setEmbeddingConfig = (config: {
  accountId?: string;
  apiKey?: string;
  model?: string;
}) => {
  embeddingConfig = config;
};

const localEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    const res = await localEmbeddingService.generateEmbeddings([text]);
    return res[0]!;
  },
  generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
    console.warn(
      `[Embedding] WARNING: Using Local Dummy Embedding Service for ${texts.length} inputs.`
    );
    // Return valid non-zero vectors of dimension 1024
    return texts.map(() => {
      const vec = new Array(1024).fill(0);
      vec[0] = 1;
      return vec;
    });
  },
};

const cloudflareEmbeddingService: IEmbeddingService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    const results = await cloudflareEmbeddingService.generateEmbeddings([text]);
    return results[0]!;
  },
  generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
    const accountId = embeddingConfig.accountId;
    const apiKey = embeddingConfig.apiKey;
    const model = embeddingConfig.model || "@cf/baai/bge-small-en-v1.5";

    if (!accountId || !apiKey) {
      throw new Error(
        "Cloudflare credentials (ACCOUNT_ID or API_KEY) are missing.",
      );
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    console.log(`[Embedding] Calling Cloudflare AI for ${texts.length} texts: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        pooling: "cls", // Recommended for better accuracy
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Embedding] Cloudflare AI API Error: ${response.status} ${response.statusText}`, errorText);
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

    return json.result.data;
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
