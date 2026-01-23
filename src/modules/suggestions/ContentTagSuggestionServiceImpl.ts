import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tagEmbeddings,
  userTags,
  contentTagSuggestions,
} from "../../db/schema";
import { getEmbeddingService } from "../../lib/embedding";
import { generateUUID, normalize } from "../../lib/uuid";
import type {
  IContentTagSuggestionService,
  ContentTagSuggestion,
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
  async extractKeywords(content: string): Promise<string[]> {
    const limit = calculateKeywordLimit(content);
    // Pre-filter candidates by TF to save API calls (max 50)
    const candidates = extractCandidates(content, [1, 2], 50);
    
    if (candidates.length === 0) return [];

    const embedder = getEmbeddingService();
    
    // Batch Embed: [Content, ...Candidates]
    // Note: Cloudflare might limit batch size. 50 is usually safe.
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
      .slice(0, limit)
      .map(s => s.word);
  }

  async ensureConceptExists(semantic: string): Promise<string> {
    const db = getDb();
    const normalized = normalize(semantic);
    const conceptId = generateUUID([normalized]);

    // Insert without embedding if it doesn't exist.
    // If it exists, we do nothing (it might have embedding or not).
    await db
      .insert(tagEmbeddings)
      .values({
        id: conceptId,
        semantic: normalized,
        embedding: null, // Placeholder
      })
      .onConflictDoNothing();

    return conceptId;
  }

  async learnTag(semantic: string): Promise<string> {
    console.log(`[SuggestionService] Learning Semantic Concept: "${semantic}"`);
    const db = getDb();
    const embedder = getEmbeddingService();
    const normalized = normalize(semantic);
    const conceptId = generateUUID([normalized]);

    // Generate embedding
    const embedding = await embedder.generateEmbedding(normalized);
    console.log(
      `[SuggestionService] Generated Embedding for "${normalized}" (Vector Size: ${embedding.length})`,
    );

    // Update or Insert with embedding
    await db
      .insert(tagEmbeddings)
      .values({
        id: conceptId,
        semantic: normalized,
        embedding: embedding,
      })
      .onConflictDoUpdate({
        target: tagEmbeddings.id,
        set: {
          embedding: embedding,
          updatedAt: new Date(),
        },
      });

    console.log(
      `[SuggestionService] Concept "${normalized}" learned/updated in DB.`,
    );
    return conceptId;
  }

  async createSuggestionsForContent(data: {
    content: string;
    contentId: string;
    userId: string;
    suggestionsCount: number;
  }): Promise<void> {
    console.log(
      `[SuggestionService] Generating suggestions for content: ${data.contentId}`,
    );
    const db = getDb();
    const embedder = getEmbeddingService();

    // 1. Generate Embedding for the content
    const contentEmbedding = await embedder.generateEmbedding(data.content);
    console.log(`[SuggestionService] Content embedding generated.`);

    // 2. Perform Similarity Search
    // Note: The <=> operator returns 'cosine distance'. Lower distance = Higher similarity.
    const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;

    const suggestions = await db
      .select({
        id: userTags.id,
        name: userTags.name,
        semantic: tagEmbeddings.semantic,
        score: distance,
      })
      .from(userTags)
      .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
      .where(eq(userTags.userId, data.userId))
      .orderBy(distance) // Closest distance first
      .limit(data.suggestionsCount);

    console.log(`[SuggestionService] Found ${suggestions.length} suggestions.`);

    // 3. Store Suggestions
    // Transactional safety would be good here, but for now we'll do delete-then-insert
    await db
      .delete(contentTagSuggestions)
      .where(eq(contentTagSuggestions.contentId, data.contentId));

    if (suggestions.length > 0) {
      await db.insert(contentTagSuggestions).values(
        suggestions.map((s) => ({
          id: generateUUID(),
          contentId: data.contentId,
          tagId: s.id,
          userId: data.userId,
          score: String(s.score),
        })),
      );
    }

    // Invalidate Cache
    const cacheKey = CacheServiceUpstash.generateKey(
      "suggestions",
      "list",
      data.userId,
      data.contentId,
    );
    await CacheServiceUpstash.del(cacheKey);

    console.log(`[SuggestionService] Suggestions saved to DB.`);
  }

  async getSuggestionsForContent(
    contentId: string,
    userId: string,
  ): Promise<ContentTagSuggestion[]> {
    const cacheKey = CacheServiceUpstash.generateKey(
      "suggestions",
      "list",
      userId,
      contentId,
    );
    const cached =
      await CacheServiceUpstash.get<ContentTagSuggestion[]>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    // Join contentTagSuggestions with userTags to get names
    const results = await db
      .select({
        suggestionId: contentTagSuggestions.id,
        score: contentTagSuggestions.score,
        tag: userTags,
      })
      .from(contentTagSuggestions)
      .innerJoin(userTags, eq(contentTagSuggestions.tagId, userTags.id))
      .where(
        and(
          eq(contentTagSuggestions.contentId, contentId),
          eq(contentTagSuggestions.userId, userId),
        ),
      );

    const data: ContentTagSuggestion[] = results.map((r) => ({
      id: r.suggestionId,
      score: r.score,
      tag: r.tag,
    })).sort(
      (a, b) => parseFloat(a.score) - parseFloat(b.score),
    );

    await CacheServiceUpstash.set(cacheKey, data);

    return data;
  }
}
