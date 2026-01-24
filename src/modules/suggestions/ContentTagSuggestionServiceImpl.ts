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

const KEYWORD_COLLISION_THRESHOLD = 0.3; // Distance lower than this means it's the same concept
const MIN_KEYWORD_SIMILARITY = 0.4; // Keywords must have at least this similarity to the document

export class ContentTagSuggestionServiceImpl implements IContentTagSuggestionService {
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
    const results = await this.extractKeywordsInternal(content);
    return results.map(r => ({ word: r.word, score: r.score }));
  }

  private async extractKeywordsInternal(content: string): Promise<{ word: string; score: number; embedding: number[] }[]> {
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
        score: cVec ? cosineSimilarity(docVector, cVec) : 0,
        embedding: cVec || []
      };
    });

    // Sort by Similarity (Desc), filter by threshold, and take top 'limit'
    return scored
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score >= MIN_KEYWORD_SIMILARITY)
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
    let rawKeywords: { word: string; score: number; embedding: number[] }[] = [];
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
        rawKeywords = await this.extractKeywordsInternal(data.content);
      })());
    }

    await Promise.all(tasks);

    // 2. Filter Keywords
    // Strategy: 
    // a) Remove exact name matches
    // b) Remove keywords that are semantically too close to user's EXISTING tags
    
    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    let filteredKeywords = rawKeywords.filter(k => !existingNames.has(normalize(k.word)));

    let result: ContentSuggestions;

    if (filteredKeywords.length > 0 && (mode === "keywords" || mode === "both")) {
      // Semantic Collision Check:
      // For each keyword, check if user has ANY tag with distance < threshold
      // We do this in a single efficient query using LATERAL join for all keywords
      
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

      // c) Internal Self-Grouping:
      // Instead of discarding, we group "jvm" and "the jvm" together.
      // Since filteredKeywords is already sorted by score (desc), the first 
      // occurrence of a concept becomes the "Primary" keyword for that group.
      const groupedPotentials: { 
        keyword: string; 
        score: number; 
        embedding: number[];
        variants: string[];
      }[] = [];

      for (const candidate of filteredKeywords) {
        const matchingGroup = groupedPotentials.find(group => {
          const sim = cosineSimilarity(candidate.embedding, group.embedding);
          const dist = 1 - sim;
          return dist < KEYWORD_COLLISION_THRESHOLD;
        });

        if (matchingGroup) {
          // Add to variants if not exactly the same string
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