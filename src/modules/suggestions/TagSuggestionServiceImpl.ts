import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tagEmbeddings, userTags, contentTagSuggestions } from "../../db/schema";
import { getEmbeddingService } from "../../lib/embedding";
import { generateUUID, normalize } from "../../lib/uuid";
import type {
  ITagSuggestionService,
  ContentSuggestion,
} from "./TagSuggestionService";

export class TagSuggestionServiceImpl implements ITagSuggestionService {
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
    console.log(`[SuggestionService] Generated Embedding for "${normalized}" (Vector Size: ${embedding.length})`);
    
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
    
    console.log(`[SuggestionService] Concept "${normalized}" learned/updated in DB.`);
    return conceptId;
  }

  async createSuggestionsForContent(data: {
    content: string;
    contentId: string;
    userId: string;
    suggestionsCount: number;
  }): Promise<void> {
    console.log(`[SuggestionService] Generating suggestions for content: ${data.contentId}`);
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
      .where(
        eq(userTags.userId, data.userId)
      )
      .orderBy(distance) // Closest distance first
      .limit(data.suggestionsCount);
    
    console.log(`[SuggestionService] Found ${suggestions.length} suggestions.`);

    // 3. Store Suggestions
    // Transactional safety would be good here, but for now we'll do delete-then-insert
    await db.delete(contentTagSuggestions)
        .where(eq(contentTagSuggestions.contentId, data.contentId));

    if (suggestions.length > 0) {
        await db.insert(contentTagSuggestions).values(
            suggestions.map(s => ({
                id: generateUUID(),
                contentId: data.contentId,
                tagId: s.id,
                userId: data.userId,
                score: String(s.score),
            }))
        );
    }
    console.log(`[SuggestionService] Suggestions saved to DB.`);
  }

  async getSuggestionsForContent(
    contentId: string,
  ): Promise<ContentSuggestion[]> {
    const db = getDb();

    // Join contentTagSuggestions with userTags to get names
    const results = await db
      .select({
        id: contentTagSuggestions.id,
        tagId: userTags.id,
        name: userTags.name,
        score: contentTagSuggestions.score,
      })
      .from(contentTagSuggestions)
      .innerJoin(userTags, eq(contentTagSuggestions.tagId, userTags.id))
      .where(
        eq(contentTagSuggestions.contentId, contentId),
      );

    return results.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
  }
}