import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { contentSuggestions, contents, userTags } from "../../db/schema";
import { getAIService } from "../../lib/ai";
import { generateUUID, normalize } from "../../lib/uuid";
import type {
  IContentTagSuggestionService,
  ContentSuggestions,
  ExistingSuggestion,
  PotentialSuggestion,
} from "./ContentTagSuggestionService";

export class ContentTagSuggestionServiceImpl implements IContentTagSuggestionService {
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
    const ai = getAIService();
    const prompt = `Analyze the following text.
1. Identify the most relevant topics, themes, and entities (e.g. "Wisdom", "Growth", "React", "Economics").
2. Focus primarily on the Title and introductory text (Description) for core themes.
3. Use the remaining text (Body/Transcript) for specific details but ignore conversational noise.
4. Return the result as a list of lines, where each line contains the keyword and its score separated by a pipe symbol "|".
5. Format: Keyword | Score
6. Example:
Wisdom | 0.9
Personal Growth | 0.85
7. Do NOT output any other text or markdown.

TEXT:
${content.slice(0, 4000)}`;

    try {
      const response = await ai.generateText(prompt, "You are a precise metadata assistant.");
      
      const lines = response.split("\n");
      const keywords: { word: string; score: number }[] = [];

      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length >= 2) {
          const word = parts[0]!.trim();
          const scoreStr = parts[1]!.trim();
          const score = parseFloat(scoreStr);

          if (word.length > 1 && !isNaN(score)) {
             keywords.push({ word, score });
          }
        }
      }
      
      return keywords;
    } catch (e) {
      console.error("[SuggestionService] Extraction failed:", e);
      return [];
    }
  }

  async getSuggestionsForContent(contentId: string, userId: string): Promise<ContentSuggestions> {
    const db = getDb();
    
    // 1. Try Cache (DB)
    const cached = await db
      .select({ data: contentSuggestions.data })
      .from(contentSuggestions)
      .where(eq(contentSuggestions.contentId, contentId))
      .limit(1);

    if (cached.length > 0 && cached[0]?.data) {
      const data = cached[0].data;
      
      // 2. Runtime Filter: Ensure existing tags are still valid
      if (data.existing && data.existing.length > 0) {
        const tagIds = data.existing.map(e => e.tagId);
        const validTags = await db
          .select({ id: userTags.id })
          .from(userTags)
          .where(inArray(userTags.id, tagIds));
        
        const validIdSet = new Set(validTags.map(v => v.id));
        data.existing = data.existing.filter(e => validIdSet.has(e.tagId));
      }
      
      return data;
    }

    // 3. Cache Miss: Regenerate
    return this.regenerateSuggestionsForContent(contentId, userId);
  }

  async generateSuggestionsForText(text: string, userId: string): Promise<ContentSuggestions> {
    const db = getDb();
    if (!text.trim()) return { existing: [], potential: [] };

    // 1. Extract Keywords
    const keywords = await this.extractKeywords(text);
    if (keywords.length === 0) return { existing: [], potential: [] };

    // 2. Match with User Tags
    const keywordSemantics = keywords.map(k => normalize(k.word));
    
    let matchingTags: { id: string; name: string; semantic: string }[] = [];
    
    if (keywordSemantics.length > 0) {
        matchingTags = await db
        .select({
            id: userTags.id,
            name: userTags.name,
            semantic: userTags.semantic,
        })
        .from(userTags)
        .where(
            and(
            eq(userTags.userId, userId),
            inArray(userTags.semantic, keywordSemantics)
            )
        );
    }

    const tagMap = new Map(matchingTags.map(t => [t.semantic, t]));
    
    const existing: ExistingSuggestion[] = [];
    const potential: PotentialSuggestion[] = [];
    const processedSemantics = new Set<string>();

    for (const kw of keywords) {
      const semantic = normalize(kw.word);
      if (processedSemantics.has(semantic)) continue;
      processedSemantics.add(semantic);

      const tag = tagMap.get(semantic);
      if (tag) {
        existing.push({
          tagId: tag.id,
          name: tag.name,
          score: kw.score
        });
      } else {
        potential.push({
          keyword: kw.word,
          score: kw.score,
          variants: []
        });
      }
    }

    // Sort by score
    existing.sort((a, b) => b.score - a.score);
    potential.sort((a, b) => b.score - a.score);

    return { existing, potential };
  }

  async regenerateSuggestionsForContent(contentId: string, userId: string): Promise<ContentSuggestions> {
    const db = getDb();

    // 1. Fetch Content
    const contentRow = await db
      .select({ title: contents.title, body: contents.body })
      .from(contents)
      .where(and(eq(contents.id, contentId), eq(contents.userId, userId)))
      .limit(1);

    if (contentRow.length === 0) {
      return { existing: [], potential: [] };
    }

    const textToAnalyze = `${contentRow[0].title}\n\n${contentRow[0].body}`;
    
    // 2. Generate
    const result = await this.generateSuggestionsForText(textToAnalyze, userId);

    // 3. Save to DB (Upsert)
    const suggestionId = generateUUID();
    
    await db
      .insert(contentSuggestions)
      .values({
        id: suggestionId,
        contentId,
        data: result,
      })
      .onConflictDoUpdate({
        target: contentSuggestions.contentId,
        set: {
          data: result,
          updatedAt: new Date(),
        },
      });

    return result;
  }
}