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
    // For standalone extraction, we pass no candidates
    const { newKeywords } = await this.extractAndSelectTags(content, []);
    return newKeywords.map(r => ({ word: r.word, score: r.score }));
  }

  private async extractAndSelectTags(
    content: string, 
    candidateTags: string[] = [], 
    contentEmbedding: number[] | null = null
  ): Promise<{ selectedNames: string[]; newKeywords: { word: string; score: number; embedding: number[]; fromAI: boolean }[] }> {
    const limit = 40; 
    const ai = getAIService();
    
    let selectedNames: string[] = [];
    let newCandidates: string[] = [];
    let isFromAI = false;

    // 1. Smart RAG Prompt
    try {
      const prompt = `Analyze the text and the Candidate Tags.
      
      TASK 1 (SELECTED): From Candidate Tags, keep ONLY those strictly relevant to the text. Discard irrelevant ones.
      TASK 2 (NEW): Extract core technical keywords/entities from the text NOT in Candidate Tags. Capture full names (e.g. "React Native" not "React", "Native").
      
      CANDIDATE TAGS:
      ${candidateTags.length > 0 ? candidateTags.join(", ") : "(None)"}
      
      TEXT:
      ${content.slice(0, 3000)}
      
      OUTPUT FORMAT:
      SELECTED: <comma-separated list>
      NEW: <comma-separated list>
      `;

      const aiResponse = await ai.generateText(prompt, "You are a precise metadata assistant. You filter tags and extract keywords.");
      
      if (aiResponse && aiResponse.trim().length > 0) {
        // Parse SELECTED
        const selectedMatch = aiResponse.match(/SELECTED:(.*?)(?:NEW:|$)/is);
        if (selectedMatch && selectedMatch[1]) {
            selectedNames = selectedMatch[1]
              .split(",")
              .map(t => t.trim())
              .filter(t => t.length > 0 && t.toLowerCase() !== "none");
        }

        // Parse NEW
        const newMatch = aiResponse.match(/NEW:(.*?)$/is);
        if (newMatch && newMatch[1]) {
            newCandidates = newMatch[1]
              .split(",")
              .map(t => t.trim())
              .filter(t => t.length > 2 && t.length < 50 && !t.toLowerCase().includes("none"));
        }
        
        // Normalize Selected names to match input candidates (case-insensitive check)
        selectedNames = selectedNames.map(s => {
            const original = candidateTags.find(c => c.toLowerCase() === s.toLowerCase());
            return original || s;
        }).filter(s => candidateTags.includes(s)); // Strict filter: must be in candidates

        if (selectedNames.length > 0 || newCandidates.length > 0) {
           isFromAI = true;
        }
      }
    } catch (e) {
      console.warn("[SuggestionService] Smart RAG failed, falling back to N-grams:", e);
    }

    // 2. Fallback to N-grams for NEW keywords if AI failed (or didn't return any)
    if (!isFromAI) {
      newCandidates = extractCandidates(content, [1, 3], 50);
    }
    
    // If no new candidates found (and no selected tags), return empty
    if (newCandidates.length === 0 && selectedNames.length === 0) {
      return { selectedNames: [], newKeywords: [] };
    }

    // 3. Generate Embeddings for NEW Candidates (for deduplication/scoring)
    const embedder = getEmbeddingService();
    const inputs = newCandidates; 
    let embeddings: number[][] = [];
    
    if (inputs.length > 0) {
      try {
        embeddings = await embedder.generateEmbeddings(inputs);
      } catch (e) {
        console.error("Failed to generate embeddings for keywords:", e);
        // If embedding fails, we can't score/dedupe efficiently. Return what we have? 
        // Or return empty newKeywords but keep selectedNames.
        return { selectedNames, newKeywords: [] };
      }
    }

    const docVector = isFromAI ? null : (contentEmbedding || (embeddings.length > 0 ? embeddings[0] : null)); 
    
    const scored = newCandidates.map((word, i) => {
      const cVec = embeddings[i]!;
      // Return Similarity Score (1.0 is best)
      let score = (docVector && cVec) ? cosineSimilarity(docVector, cVec) : 0.95 - (i * 0.005);
      
      if (!isFromAI) {
        const wordCount = word.split(" ").length;
        if (wordCount > 1) score *= (1 + (wordCount - 1) * 0.05);
      }

      return { word, score, embedding: cVec, fromAI: isFromAI };
    });

    // If from AI, return all. If N-gram, filter.
    if (isFromAI) {
       return { selectedNames, newKeywords: scored };
    }

    // N-GRAM FALLBACK: Apply strict filtering
    const sorted = scored
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score >= MIN_KEYWORD_SIMILARITY);

    const finalNewKeywords: typeof sorted = [];
    for (const item of sorted) {
      const isSubPhrase = finalNewKeywords.some(existing => 
        existing.word !== item.word && existing.word.includes(item.word)
      );
      if (!isSubPhrase) finalNewKeywords.push(item);
      if (finalNewKeywords.length >= limit) break;
    }

    return { selectedNames, newKeywords: finalNewKeywords };
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

    // 1. Generate Content Embedding (Required for RAG and Tags)
    const contentEmbedding = await embedder.generateEmbedding(data.content);
    
    let candidateSuggestions: any[] = [];

    // 2. Fetch Candidate Tags (Vector Search)
    if (mode === "tags" || mode === "both" || mode === "keywords") {
       const distance = sql<number>`${tagEmbeddings.embedding} <=> ${JSON.stringify(contentEmbedding)}`;
       const similarity = sql<number>`1 - (${distance})`;
        
       candidateSuggestions = await db
          .select({
            tagId: userTags.id,
            name: userTags.name,
            score: similarity,
            embedding: tagEmbeddings.embedding,
          })
          .from(userTags)
          .innerJoin(tagEmbeddings, eq(userTags.semantic, tagEmbeddings.semantic))
          .where(eq(userTags.userId, data.userId))
          .orderBy(distance)
          .limit(40); // Fetch top 40 candidates for AI to review
    }

    // 3. Smart Extraction & Selection
    let verifiedExistingNames: string[] = [];
    let newKeywords: { word: string; score: number; embedding: number[]; fromAI: boolean }[] = [];

    if (mode === "keywords" || mode === "both" || mode === "tags") {
       const candidateNames = candidateSuggestions.map(s => s.name);
       const result = await this.extractAndSelectTags(data.content, candidateNames, contentEmbedding);
       
       verifiedExistingNames = result.selectedNames;
       newKeywords = result.newKeywords;
    }

    // 4. Filter Existing based on Verification
    // We only keep the existing tags that the AI explicitly SELECTED
    const existingSuggestions = candidateSuggestions.filter(c => verifiedExistingNames.includes(c.name));

    // 5. Filter New Keywords (Collision Check)
    const existingNames = new Set(existingSuggestions.map(s => normalize(s.name)));
    let filteredKeywords = newKeywords.filter(k => !existingNames.has(normalize(k.word)));

    let result: ContentSuggestions;

    if (filteredKeywords.length > 0 && (mode === "keywords" || mode === "both")) {
      // Collision check against verified existing tags
      const collisionChecks = filteredKeywords.map((kw) => {
        const collision = existingSuggestions.find(existing => {
           if (!existing.embedding) return false;
           // If kw.embedding is null (shouldn't be if generated correctly), skip check
           if (!kw.embedding) return false; 
           
           const sim = cosineSimilarity(kw.embedding, existing.embedding);
           const dist = 1 - sim;
           return dist < KEYWORD_COLLISION_THRESHOLD;
        });
        
        return { word: kw.word, hasCollision: !!collision };
      });

      const collidedWords = new Set(collisionChecks.filter(c => c.hasCollision).map(c => c.word));
      filteredKeywords = filteredKeywords.filter(k => !collidedWords.has(k.word));

      // Internal Self-Grouping
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
        // N-gram grouping logic
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
      result = {
        existing: existingSuggestions.map(s => ({
          tagId: s.tagId,
          name: s.name,
          score: Number(s.score).toFixed(3)
        })),
        potential: []
      };
    }

    // 3. Cache results
    const textHash = await this.hashText(data.content);
    const cacheKey = CacheServiceUpstash.generateKey("suggestions", mode, data.userId, `hash:${textHash}`);
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