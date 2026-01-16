import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tagEmbeddings,
  userTags,
  contentTagSuggestions,
} from "../../db/schema";
import { getEmbeddingService } from "../../lib/embedding";
import { generateUUID } from "../../lib/uuid";
import type {
  ITagSuggestionService,
  ContentSuggestion,
} from "./TagSuggestionService";

export class TagSuggestionServiceImpl implements ITagSuggestionService {
  async learnTag(semantic: string): Promise<string> {
    const db = getDb();
    const embedder = getEmbeddingService();
    const conceptId = generateUUID([semantic]);

    // Generate embedding and upsert to ensure we have real data
    const embedding = await embedder.generateEmbedding(semantic);
    await db
      .insert(tagEmbeddings)
      .values({
        id: conceptId,
        semantic: semantic,
        embedding: embedding,
      })
      .onConflictDoUpdate({
        target: tagEmbeddings.id,
        set: {
          embedding: embedding,
          updatedAt: new Date(),
        },
      });

    return conceptId;
  }

  async createSuggestionsForContent(data: {
    content: string;
    contentId: string;
    userId: string;
    suggestionsCount: number;
    threshold: number;
  }): Promise<void> {
    const db = getDb();
    const embedder = getEmbeddingService();

    // 1. Generate Embedding for the content
    const contentEmbedding = await embedder.generateEmbedding(data.content);

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
      .innerJoin(tagEmbeddings, eq(userTags.embeddingId, tagEmbeddings.id))
      .where(
        and(
          eq(userTags.userId, data.userId),
          sql`${distance} <= ${data.threshold}` // Filter by distance in DB
        )
      )
      .orderBy(distance) // Closest distance first
      .limit(data.suggestionsCount);
    
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
