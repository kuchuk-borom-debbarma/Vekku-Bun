import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tagEmbeddings,
  userTags,
  contentTagSuggestions,
  contentKeywordSuggestions,
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
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
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
      .slice(0, limit);
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

  async learnTags(semantics: string[]): Promise<string[]> {
    if (semantics.length === 0) return [];
    
    console.log(`[SuggestionService] Learning Semantic Concepts: ${semantics.length} items`);
    const db = getDb();
    const embedder = getEmbeddingService();
    
    // Deduplicate and normalize
    const uniqueSemantics = Array.from(new Set(semantics.map(s => normalize(s))));
    
    // Generate embeddings in batch
    console.log(`[SuggestionService] Generating embeddings for ${uniqueSemantics.length} concepts...`);
    const embeddings = await embedder.generateEmbeddings(uniqueSemantics);
    
    const valuesToInsert = uniqueSemantics.map((semantic, i) => ({
      id: generateUUID([semantic]),
      semantic,
      embedding: embeddings[i],
      updatedAt: new Date(),
    }));

    // Batch Upsert
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
    contentId: string;
    userId: string;
    suggestionsCount: number;
  }): Promise<void> {
    console.log(
      `[SuggestionService] Generating suggestions for content: ${data.contentId}`,
    );
    const db = getDb();
    const embedder = getEmbeddingService();

    // 1. Generate Content Embedding & Extract Keywords (Parallel)
    // Note: extractKeywords also generates content embedding internally. 
    // Optimization: We could share it, but for simplicity/decoupling, we let them run.
    // However, since Cloudflare AI is fast, two calls are fine. Or we can reuse if we refactor.
    // Let's run them in parallel.
    
    const [contentEmbedding, rawKeywords] = await Promise.all([
      embedder.generateEmbedding(data.content),
      this.extractKeywords(data.content)
    ]);

    console.log(`[SuggestionService] Content embedding & keywords generated.`);

    // 2. Perform Similarity Search for Existing Tags
    const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;

    const existingSuggestions = await db
      .select({
        id: userTags.id,
        name: userTags.name,
        semantic: tagEmbeddings.semantic,
        score: distance,
      })
      .from(userTags)
      .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
      .where(eq(userTags.userId, data.userId))
      .orderBy(distance)
      .limit(data.suggestionsCount);

    console.log(`[SuggestionService] Found ${existingSuggestions.length} existing tag matches.`);

    // 3. Filter Keywords (Dedup against Existing)
    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    const newKeywords = rawKeywords.filter(k => !existingNames.has(normalize(k.word)));

    console.log(`[SuggestionService] Found ${newKeywords.length} new keyword suggestions.`);

    // 4. Store Suggestions (Transactional ideally)
    await Promise.all([
      db.delete(contentTagSuggestions).where(eq(contentTagSuggestions.contentId, data.contentId)),
      db.delete(contentKeywordSuggestions).where(eq(contentKeywordSuggestions.contentId, data.contentId))
    ]);

    const promises = [];

    if (existingSuggestions.length > 0) {
      promises.push(
        db.insert(contentTagSuggestions).values(
          existingSuggestions.map((s) => ({
            id: generateUUID(),
            contentId: data.contentId,
            tagId: s.id,
            userId: data.userId,
            score: String(s.score),
          })),
        )
      );
    }

    if (newKeywords.length > 0) {
      promises.push(
        db.insert(contentKeywordSuggestions).values(
          newKeywords.map((k) => ({
            id: generateUUID(),
            contentId: data.contentId,
            userId: data.userId,
            keyword: k.word,
            score: String(k.score), // Similarity (Higher is better)
          })),
        )
      );
    }

    await Promise.all(promises);

    // Invalidate Cache
    const cacheKey = CacheServiceUpstash.generateKey(
      "suggestions",
      "list",
      data.userId,
      data.contentId,
    );
    await CacheServiceUpstash.del(cacheKey);

    console.log(`[SuggestionService] All suggestions saved to DB.`);
  }

  async getSuggestionsForContent(
    contentId: string,
    userId: string,
  ): Promise<any> { // Update implementation to match new interface structure
    const cacheKey = CacheServiceUpstash.generateKey(
      "suggestions",
      "list",
      userId,
      contentId,
    );
    const cached = await CacheServiceUpstash.get<any>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    // 1. Fetch Existing Tag Suggestions
    const tagResults = await db
      .select({
        tagId: userTags.id,
        name: userTags.name,
        score: contentTagSuggestions.score,
      })
      .from(contentTagSuggestions)
      .innerJoin(userTags, eq(contentTagSuggestions.tagId, userTags.id))
      .where(
        and(
          eq(contentTagSuggestions.contentId, contentId),
          eq(contentTagSuggestions.userId, userId),
        ),
      );

    // 2. Fetch Keyword Suggestions
    const keywordResults = await db
      .select({
        keyword: contentKeywordSuggestions.keyword,
        score: contentKeywordSuggestions.score,
      })
      .from(contentKeywordSuggestions)
      .where(
        and(
          eq(contentKeywordSuggestions.contentId, contentId),
          eq(contentKeywordSuggestions.userId, userId),
        ),
      );

    // 3. Format and Sort
    const existing = tagResults
      .map((r) => ({
        tagId: r.tagId,
        name: r.name,
        score: r.score,
      }))
      .sort((a, b) => parseFloat(a.score) - parseFloat(b.score));

    const potential = keywordResults
      .map((r) => ({
        keyword: r.keyword,
        score: r.score,
      }))
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score)); // Similarity: Higher is better

    const result = { existing, potential };

    await CacheServiceUpstash.set(cacheKey, result);

    return result;
  }
}
