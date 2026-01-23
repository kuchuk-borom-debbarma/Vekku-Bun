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

    if (!docVector) return [];

    const scored = candidates.map((word, i) => {
      const cVec = candidateVectors[i];
      return {
        word,
        score: cVec ? cosineSimilarity(docVector, cVec) : 0
      };
    });

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
    mode?: "tags" | "keywords" | "both";
  }): Promise<ContentSuggestions> {
    const mode = data.mode || "both";
    console.log(`[SuggestionService] Generating [${mode}] suggestions for user: ${data.userId}`);
    
    const db = getDb();
    const embedder = getEmbeddingService();

    let contentEmbedding: number[] | null = null;
    let rawKeywords: { word: string; score: number }[] = [];
    let existingSuggestions: any[] = [];

    // 1. Generate tasks based on mode
    const tasks = [];
    
    if (mode === "tags" || mode === "both") {
      tasks.push((async () => {
        contentEmbedding = await embedder.generateEmbedding(data.content);
        const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;
        existingSuggestions = await db
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
      })());
    }

    if (mode === "keywords" || mode === "both") {
      tasks.push((async () => {
        rawKeywords = await this.extractKeywords(data.content);
      })());
    }

    await Promise.all(tasks);

    // 2. Filter Keywords (Dedup against Existing if both present or keywords only)
    // If we only extracted keywords, we don't strictly need to dedup against ALL user tags here (slow),
    // but we should at least dedup against existingSuggestions if they were fetched.
    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    const filteredKeywords = rawKeywords.filter(k => !existingNames.has(normalize(k.word)));

    const result: ContentSuggestions = {
      existing: existingSuggestions.map(s => ({
        tagId: s.tagId,
        name: s.name,
        score: Number(s.score).toFixed(3)
      })),
      potential: filteredKeywords.map(k => ({
        keyword: k.word,
        score: (1 - k.score).toFixed(3) // Invert similarity to distance: lower is better
      }))
    };

    // 3. Cache results
    // If contentId exists, use it as the primary key.
    // If not (e.g. creating content), use a hash of the text to prevent repeat 429s for same input.
    const anchor = data.contentId || `hash:${await this.hashText(data.content)}`;
    const cacheKey = CacheServiceUpstash.generateKey("suggestions", mode, data.userId, anchor);
    
    // Cache for 24 hours if it's a real content ID, or 10 minutes if it's just a text hash
    const ttl = data.contentId ? 60 * 60 * 24 : 60 * 10;
    await CacheServiceUpstash.set(cacheKey, result, ttl);

    return result;
  }

  async getSuggestionsForContent(
    contentId: string,
    userId: string,
    mode: "tags" | "keywords" | "both" = "both",
    text?: string,
  ): Promise<ContentSuggestions | null> {
    const anchor = contentId || (text ? `hash:${await this.hashText(text)}` : null);
    if (!anchor) return null;

    const cacheKey = CacheServiceUpstash.generateKey("suggestions", mode, userId, anchor);
    return await CacheServiceUpstash.get<ContentSuggestions>(cacheKey);
  }

  private async hashText(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
}