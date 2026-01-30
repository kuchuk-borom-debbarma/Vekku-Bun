import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { getEmbeddingService } from "../../lib/embedding";
import type { IContentEmbeddingService } from "./ContentEmbeddingService";
import type { Content } from "./ContentService";
import { ContentType } from "./ContentService";

export class ContentEmbeddingServiceImpl implements IContentEmbeddingService {
  async generateAndSaveEmbedding(content: Content): Promise<void> {
    const textToEmbed = `${content.title}\n\n${content.body}`;
    // Truncate to avoid token limits. bge-small-en-v1.5 has 512 token limit (~2000 chars is safe-ish upper bound)
    const safeText = textToEmbed.substring(0, 2000);

    try {
      const embeddingService = getEmbeddingService();
      const embedding = await embeddingService.generateEmbedding(safeText);

      const db = getDb();
      await db
        .insert(schema.contentEmbeddings)
        .values({
          contentId: content.id,
          embedding: embedding,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.contentEmbeddings.contentId],
          set: {
            embedding: embedding,
            updatedAt: new Date(),
          },
        });
      console.log(
        `[ContentEmbedding] Generated embedding for content: ${content.id}`,
      );
    } catch (error) {
      console.error(
        `[ContentEmbedding] Failed to generate embedding for ${content.id}:`,
        error,
      );
    }
  }

  async searchContent(
    userId: string,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Content[]> {
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    // 1 - (A <=> B) is Cosine Similarity (where <=> is Cosine Distance)
    // We cast the embedding to vector(384) to match the column definition explicitly if needed,
    // but Drizzle usually handles array -> vector mapping.
    const similarity = sql<number>`1 - (${schema.contentEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)})`;

    const db = getDb();
    const results = await db
      .select({
        content: schema.contents,
        similarity: similarity,
      })
      .from(schema.contentEmbeddings)
      .innerJoin(
        schema.contents,
        eq(schema.contentEmbeddings.contentId, schema.contents.id),
      )
      .where(
        and(
          eq(schema.contents.userId, userId),
          gt(similarity, 0.4), // Threshold: 0.4 is generous, can be tuned
        ),
      )
      .orderBy(desc(similarity))
      .limit(limit)
      .offset(offset);

    return results.map((r) => ({
      id: r.content.id,
      title: r.content.title,
      body: r.content.body,
      userId: r.content.userId,
      contentType: r.content.contentType as ContentType,
      metadata: r.content.metadata,
      createdAt: r.content.createdAt,
      updatedAt: r.content.updatedAt,
    }));
  }
}
