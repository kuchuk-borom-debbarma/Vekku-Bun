import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tagEmbeddings,
  userTags,
} from "../../db/schema";
import { getAIService } from "../../lib/ai";
import { getEmbeddingService } from "../../lib/embedding";
import { generateUUID, normalize } from "../../lib/uuid";
import type {
  IContentTagSuggestionService,
  ContentSuggestions,
} from "./ContentTagSuggestionService";
import { CacheServiceUpstash } from "../../lib/cache";
import { calculateKeywordLimit, extractCandidates } from "../../lib/keywords";

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i]!;
    const b = vecB[i]!;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }
  const mag = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return mag === 0 ? 0 : dotProduct / mag;
}

const KEYWORD_COLLISION_THRESHOLD = 0.2; // Lowered from 0.3 to allow more distinct technical concepts
const MIN_KEYWORD_SIMILARITY = 0.4; // Keywords must have at least this similarity to the document

export class ContentTagSuggestionServiceImpl implements IContentTagSuggestionService {
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
    const results = await this.extractKeywordsInternal(content);
    return results.map(r => ({ word: r.word, score: r.score }));
  }

  private async extractKeywordsInternal(content: string): Promise<{ word: string; score: number; embedding: number[]; fromAI: boolean }[]> {
    const limit = 40; // Increased cap for more diversity
    const ai = getAIService();
    
    let candidates: string[] = [];
    let isFromAI = false;

    // 1. Try SLM Extraction (Smart)
    try {
      const prompt = `Extract all relevant, high-quality technical and subject-specific tags or keywords from the following text. 
      
      CRITICAL INSTRUCTION: The first line(s) are the TITLE. You MUST extract any multi-word entities, technologies, or subjects mentioned in the TITLE (e.g., "Unreal Engine 5", "Spring Boot", "Load Balancer"). Do NOT break them into single words.
      
      Focus on core entities and primary subjects. Avoid conversational filler or generic meta-terms.
      
      Output ONLY the tags as a comma-separated list. No numbering, no introduction, no explanation.
      
      TEXT:
      ${content.slice(0, 3000)}`;

      const aiResponse = await ai.generateText(prompt, "You are a specialized metadata extractor. You capture full names of technologies and concepts. Your output must be a single line of comma-separated tags.");
      
      if (aiResponse && aiResponse.trim().length > 0) {
        const cleanedResponse = aiResponse.replace(/^(here are|technical tags|the following|tags|keywords|extracted tags)(.*?):/i, "").trim();

        candidates = cleanedResponse
          .split(",")
          .map(t => t.replace(/^\d+\.\s*/, "").trim())
          .map(t => t.replace(/["']/g, ""))
          .filter(t => t.length > 2 && t.length < 50 && !t.toLowerCase().includes("high quality"));
        
        if (candidates.length >= 3) {
          isFromAI = true;
        }
      }
    } catch (e) {
      console.warn("[SuggestionService] SLM extraction failed, falling back to N-grams:", e);
    }

    // 2. Fallback to N-grams if SLM failed
    if (!isFromAI) {
      candidates = extractCandidates(content, [1, 3], 50);
    }
    
    if (candidates.length === 0) return [];

    const embedder = getEmbeddingService();
    const inputs = isFromAI ? candidates : [content, ...candidates];
    let embeddings: number[][];
    
    try {
      embeddings = await embedder.generateEmbeddings(inputs);
    } catch (e) {
      console.error("Failed to generate embeddings for keywords:", e);
      return [];
    }

    const docVector = isFromAI ? null : embeddings[0];
    const candidateVectors = isFromAI ? embeddings : embeddings.slice(1);

    const scored = candidates.map((word, i) => {
      const cVec = candidateVectors[i]!;
      // Return Similarity Score (1.0 is best)
      let score = docVector ? cosineSimilarity(docVector, cVec) : 0.95 - (i * 0.005);
      
      if (!isFromAI) {
        const wordCount = word.split(" ").length;
        if (wordCount > 1) score *= (1 + (wordCount - 1) * 0.05);
      }

      return { word, score, embedding: cVec, fromAI: isFromAI };
    });

    if (isFromAI) {
      return scored; // Return all AI results
    }

    // N-GRAM FALLBACK: Apply strict filtering
    const sorted = scored
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score >= MIN_KEYWORD_SIMILARITY);

    const finalResults: typeof sorted = [];
    for (const item of sorted) {
      const isSubPhrase = finalResults.some(existing => 
        existing.word !== item.word && existing.word.includes(item.word)
      );
      if (!isSubPhrase) finalResults.push(item);
      if (finalResults.length >= limit) break;
    }

    return finalResults;
  }

  async ensureConceptExists(semantic: string): Promise<string> {
    const db = getDb();
    const normalized = normalize(semantic);
    const conceptId = generateUUID([normalized]);

    await db
      .insert(tagEmbeddings)
      .values({
        id: conceptId,
        semantic: normalized,
        embedding: null, 
      })
      .onConflictDoNothing();

    return conceptId;
  }

  async learnTags(semantics: string[]): Promise<string[]> {
    if (semantics.length === 0) return [];
    
    const db = getDb();
    const embedder = getEmbeddingService();
    const uniqueSemantics = Array.from(new Set(semantics.map(s => normalize(s))));
    const embeddings = await embedder.generateEmbeddings(uniqueSemantics);
    
    const valuesToInsert = uniqueSemantics.map((semantic, i) => ({
      id: generateUUID([semantic]),
      semantic,
      embedding: embeddings[i],
      updatedAt: new Date(),
    }));

    await db
      .insert(tagEmbeddings)
      .values(valuesToInsert)
      .onConflictDoUpdate({
        target: tagEmbeddings.id,
        set: {
          embedding: sql`excluded.embedding`,
          updatedAt: new Date(),
        },
      });

    return valuesToInsert.map(v => v.id);
  }

  async createSuggestionsForContent(data: {
    content: string;
    contentId?: string;
    userId: string;
    suggestionsCount: number;
    mode?: "tags" | "keywords" | "both";
  }): Promise<ContentSuggestions> {
    const mode = data.mode || "both";
    const db = getDb();
    const embedder = getEmbeddingService();

    let contentEmbedding: number[] | null = null;
    let rawKeywords: { word: string; score: number; embedding: number[] }[] = [];
    let existingSuggestions: any[] = [];

    // 1. Generate tasks based on mode
    const tasks = [];
    
    if (mode === "tags" || mode === "both") {
      tasks.push((async () => {
        contentEmbedding = await embedder.generateEmbedding(data.content);
        const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;
        const similarity = sql<number>`1 - (${distance})`;
        
        existingSuggestions = await db
          .select({
            tagId: userTags.id,
            name: userTags.name,
            score: similarity,
          })
          .from(userTags)
          .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
          .where(eq(userTags.userId, data.userId))
          .orderBy(distance)
          .limit(30); // Increased limit for better matching
      })());
    }

    if (mode === "keywords" || mode === "both") {
      tasks.push((async () => {
        rawKeywords = await this.extractKeywordsInternal(data.content);
      })());
    }

    await Promise.all(tasks);

    // 2. Filter Keywords
    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    let filteredKeywords = rawKeywords.filter(k => !existingNames.has(normalize(k.word)));

    let result: ContentSuggestions;

    if (filteredKeywords.length > 0 && (mode === "keywords" || mode === "both")) {
      // a) Semantic Collision Check against user's EXISTING tags
      // We ALWAYS do this to prevent suggesting "PostgreSQL" if the user has "Postgres"
      const collisionChecks = await Promise.all(filteredKeywords.map(async (kw) => {
        const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(kw.embedding)}`;
        const match = await db
          .select({ id: userTags.id })
          .from(userTags)
          .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
          .where(and(
            eq(userTags.userId, data.userId),
            sql`${distance} < ${KEYWORD_COLLISION_THRESHOLD}`
          ))
          .limit(1);
        
        return { word: kw.word, hasCollision: match.length > 0 };
      }));

      const collidedWords = new Set(collisionChecks.filter(c => c.hasCollision).map(c => c.word));
      filteredKeywords = filteredKeywords.filter(k => !collidedWords.has(k.word));

      // b) Internal Self-Grouping
      // If from AI, we SKIP this and trust the AI's distinct entities.
      // If from N-grams, we do it to clean up fragments.
      const isFromAI = filteredKeywords.length > 0 && filteredKeywords[0]!.fromAI;
      
      let groupedPotentials: { 
        keyword: string; 
        score: number; 
        embedding: number[];
        variants: string[];
      }[] = [];

      if (isFromAI) {
        groupedPotentials = filteredKeywords.map(k => ({
          keyword: k.word,
          score: k.score,
          embedding: k.embedding,
          variants: []
        }));
      } else {
        for (const candidate of filteredKeywords) {
          const matchingGroup = groupedPotentials.find(group => {
            const sim = cosineSimilarity(candidate.embedding, group.embedding);
            const dist = 1 - sim;
            return dist < KEYWORD_COLLISION_THRESHOLD;
          });

          if (matchingGroup) {
            if (candidate.word.toLowerCase() !== matchingGroup.keyword.toLowerCase()) {
              matchingGroup.variants.push(candidate.word);
            }
          } else {
            groupedPotentials.push({
              keyword: candidate.word,
              score: candidate.score,
              embedding: candidate.embedding,
              variants: []
            });
          }
        }
      }

      result = {
        existing: existingSuggestions.map(s => ({
          tagId: s.tagId,
          name: s.name,
          score: Number(s.score).toFixed(3)
        })),
        potential: groupedPotentials.map(g => ({
          keyword: g.keyword,
          score: (1 - g.score).toFixed(3),
          variants: g.variants
        }))
      };
    } else {
      // Fallback for when no keywords were filtered or mode is tags only
      result = {
        existing: existingSuggestions.map(s => ({
          tagId: s.tagId,
          name: s.name,
          score: Number(s.score).toFixed(3)
        })),
        potential: []
      };
    }

    // 3. Cache results based on text hash
    // This allows same content to hit cache even before it's saved or across different content IDs
    const textHash = await this.hashText(data.content);
    const cacheKey = CacheServiceUpstash.generateKey("suggestions", mode, data.userId, `hash:${textHash}`);
    
    // AI results are expensive, cache for 24 hours
    await CacheServiceUpstash.set(cacheKey, result, 60 * 60 * 24);

    return result;
  }

  async getSuggestionsForContent(
    contentId: string | undefined, // Ignored in favor of text hash for better cache sharing
    userId: string,
    mode: "tags" | "keywords" | "both" = "both",
    text?: string,
  ): Promise<ContentSuggestions | null> {
    if (!text) return null;

    const textHash = await this.hashText(text);
    const cacheKey = CacheServiceUpstash.generateKey("suggestions", mode, userId, `hash:${textHash}`);
    return await CacheServiceUpstash.get<ContentSuggestions>(cacheKey);
  }

  private async hashText(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
}