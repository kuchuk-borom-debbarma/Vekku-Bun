export interface IAIService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
}

let aiConfig: { accountId?: string; apiKey?: string; embeddingModel?: string; slmModel?: string } = {};

export const setAIConfig = (config: {
  accountId?: string;
  apiKey?: string;
  embeddingModel?: string;
  slmModel?: string;
}) => {
  aiConfig = { ...aiConfig, ...config };
};

const localAIService: IAIService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    return new Array(1024).fill(0).map((_, i) => (i === 0 ? 1 : 0));
  },
  generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
    return texts.map(() => localAIService.generateEmbedding(""));
  },
  generateText: async (prompt: string): Promise<string> => {
    return "local, ai, fallback, tags";
  },
};

const cloudflareAIService: IAIService = {
  generateEmbedding: async (text: string): Promise<number[]> => {
    const results = await cloudflareAIService.generateEmbeddings([text]);
    return results[0]!;
  },

  generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
    const { accountId, apiKey, embeddingModel } = aiConfig;
    const model = embeddingModel || "@cf/baai/bge-small-en-v1.5";

    if (!accountId || !apiKey) throw new Error("Cloudflare AI credentials missing.");

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts, pooling: "cls" }),
    });

    if (!response.ok) throw new Error(`Embedding failed: ${response.statusText}`);
    const json = await response.json() as any;
    return json.result.data;
  },

  generateText: async (prompt: string, systemPrompt: string = "You are a precise tag extraction assistant."): Promise<string> => {
    const { accountId, apiKey, slmModel } = aiConfig;
    const model = slmModel || "@cf/meta/llama-3.2-1b-instruct";

    if (!accountId || !apiKey) throw new Error("Cloudflare AI credentials missing.");

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      }),
    });

    if (!response.ok) throw new Error(`SLM Text generation failed: ${response.statusText}`);
    const json = await response.json() as any;
    return json.result.response || json.result.text || "";
  },
};

export const getAIService = (env?: { WORKER?: string }): IAIService => {
  if (env?.WORKER || (aiConfig.accountId && aiConfig.apiKey)) {
    return cloudflareAIService;
  }
  return localAIService;
};
