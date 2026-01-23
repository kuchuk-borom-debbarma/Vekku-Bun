import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tagEmbeddings,
  userTags,
} from "../../db/schema";
import { getEmbeddingService } from "../../lib/embedding";
import { generateUUID, normalize } from "../../lib/uuid";
import type {
  IContentTagSuggestionService,
  ContentSuggestions,
} from "./ContentTagSuggestionService";
import { CacheServiceUpstash } from "../../lib/cache";
import { calculateKeywordLimit, extractCandidates } from "../../lib/keywords";

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export class ContentTagSuggestionServiceImpl implements IContentTagSuggestionService {
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
    const limit = calculateKeywordLimit(content);
    // Pre-filter candidates by TF to save API calls (max 50)
    const candidates = extractCandidates(content, [1, 2], 50);
    
    if (candidates.length === 0) return [];

    const embedder = getEmbeddingService();
    
    // Batch Embed: [Content, ...Candidates]
    const inputs = [content, ...candidates];
    let embeddings: number[][];
    
    try {
      embeddings = await embedder.generateEmbeddings(inputs);
    } catch (e) {
      console.error("Failed to generate embeddings for keywords:", e);
      return [];
    }

    const docVector = embeddings[0];
    const candidateVectors = embeddings.slice(1);

    const scored = candidates.map((word, i) => ({
      word,
      score: cosineSimilarity(docVector, candidateVectors[i])
    }));

    // Sort by Similarity (Desc) and take top 'limit'
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
    
    console.log(`[SuggestionService] Learning Semantic Concepts: ${semantics.length} items`);
    const db = getDb();
    const embedder = getEmbeddingService();
    
    const uniqueSemantics = Array.from(new Set(semantics.map(s => normalize(s))));
    
    console.log(`[SuggestionService] Generating embeddings for ${uniqueSemantics.length} concepts...`);
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

    console.log(`[SuggestionService] Learned/Updated ${valuesToInsert.length} concepts.`);
    return valuesToInsert.map(v => v.id);
  }

  async createSuggestionsForContent(data: {
    content: string;
    contentId?: string;
    userId: string;
    suggestionsCount: number;
  }): Promise<ContentSuggestions> {
    console.log(`[SuggestionService] Generating suggestions for user: ${data.userId}`);
    const db = getDb();
    const embedder = getEmbeddingService();

    const [contentEmbedding, rawKeywords] = await Promise.all([
      embedder.generateEmbedding(data.content),
      this.extractKeywords(data.content)
    ]);

    const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;

    const existingSuggestions = await db
      .select({
        tagId: userTags.id,
        name: userTags.name,
        score: distance,
      })
      .from(userTags)
      .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
      .where(eq(userTags.userId, data.userId))
      .orderBy(distance)
      .limit(data.suggestionsCount);

    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    const newKeywords = rawKeywords.filter(k => !existingNames.has(normalize(k.word)));

    const result: ContentSuggestions = {
      existing: existingSuggestions.map(s => ({
        tagId: s.tagId,
        name: s.name,
        score: String(s.score)
      })),
      potential: newKeywords.map(k => ({
        keyword: k.word,
        score: String(k.score)
      }))
    };

    if (data.contentId) {
      const cacheKey = CacheServiceUpstash.generateKey("suggestions", "list", data.userId, data.contentId);
      await CacheServiceUpstash.set(cacheKey, result);
    }

    return result;
  }

  async getSuggestionsForContent(
    contentId: string,
    userId: string,
  ): Promise<ContentSuggestions | null> {
    const cacheKey = CacheServiceUpstash.generateKey("suggestions", "list", userId, contentId);
    return await CacheServiceUpstash.get<ContentSuggestions>(cacheKey);
  }
}