import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  // Legacy method kept for interface compatibility, or for simple keyword extraction without context
  async extractKeywords(content: string): Promise<{ word: string; score: number }[]> {
    const ai = getAIService();
    const prompt = `Analyze the following text.
1. Identify the most relevant topics, themes, and entities.
2. Return the result as a list of lines: Keyword | Score
3. Do NOT output any other text.

TEXT:
${content.slice(0, 4000)}`;

    try {
      const response = await ai.generateText(prompt, "You are a precise metadata assistant.");
      return this.parseLineResponse(response);
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
    const ai = getAIService();
    
    if (!text.trim()) return { existing: [], potential: [] };

    // 1. Fetch User Tags (Context)
    // We fetch up to 1000 most recent tags to provide context to the SLM
    const userTagRows = await db
      .select({ id: userTags.id, name: userTags.name })
      .from(userTags)
      .where(eq(userTags.userId, userId))
      .orderBy(desc(userTags.createdAt))
      .limit(1000);

    const existingTagsMap = new Map<string, string>(); // name -> id
    const existingTagNames: string[] = [];

    for (const tag of userTagRows) {
      existingTagNames.push(tag.name);
      existingTagsMap.set(tag.name.toLowerCase().trim(), tag.id);
    }

    // 2. Construct Prompt
    const existingTagsBlock = existingTagNames.length > 0 
      ? `EXISTING TAGS (Select from this list if relevant):\n${existingTagNames.join(", ")}` 
      : "EXISTING TAGS:\n(None)";

    const prompt = `Analyze the TEXT and the list of EXISTING TAGS.

${existingTagsBlock}

TEXT:
${text.slice(0, 3000)}

INSTRUCTIONS:
1. "EXISTING": Select tags from the "EXISTING TAGS" list that are relevant to the TEXT. Match them exactly or closely (e.g. "ReactJS" -> "React").
2. "NEW": Suggest NEW tags that are relevant to the TEXT but are NOT in the "EXISTING TAGS" list.
3. Assign a relevance score (0.0 - 1.0) to each.
4. Output strict sections.

OUTPUT FORMAT:
EXISTING:
tag_name | 0.9
tag_name | 0.8

NEW:
new_tag | 0.9
other_tag | 0.7`;

    // 3. Call AI
    let response = "";
    try {
      response = await ai.generateText(prompt, "You are a precise tagging assistant.");
    } catch (e) {
      console.error("[SuggestionService] AI generation failed:", e);
      return { existing: [], potential: [] };
    }

    // 4. Parse Response
    const existing: ExistingSuggestion[] = [];
    const potential: PotentialSuggestion[] = [];

    const sections = response.split(/^(?:EXISTING|NEW):/m);
    // sections[0] is usually preamble (empty or text before first match)
    // We need to identify which section is which.
    
    // Safer regex approach to find blocks
    const existingMatch = response.match(/EXISTING:\s*([\s\S]*?)(?=NEW:|$)/i);
    const newMatch = response.match(/NEW:\s*([\s\S]*?)(?=$)/i);

    const parseBlock = (block: string) => {
        return block.split("\n")
            .map(line => line.trim())
            .filter(line => line.includes("|"))
            .map(line => {
                const [word, scoreStr] = line.split("|").map(s => s.trim());
                const score = parseFloat(scoreStr || "0");
                return { word: word || "", score: !isNaN(score) ? score : 0 };
            })
            .filter(item => item.word.length > 0);
    };

    if (existingMatch && existingMatch[1]) {
        const items = parseBlock(existingMatch[1]);
        for (const item of items) {
            // Try to find the tag ID
            // We search case-insensitive
            const normalizedName = item.word.toLowerCase();
            const id = existingTagsMap.get(normalizedName);
            
            if (id) {
                existing.push({ tagId: id, name: item.word, score: item.score });
            } else {
                // If AI put it in EXISTING but we can't find it, treat it as potential? 
                // Or maybe it hallucinated. Safe to ignore or move to potential.
                // Let's check if it was a fuzzy match case that we missed.
                // For now, strict match on what we sent.
            }
        }
    }

    if (newMatch && newMatch[1]) {
        const items = parseBlock(newMatch[1]);
        for (const item of items) {
            // Double check it's not existing
            if (!existingTagsMap.has(item.word.toLowerCase())) {
                potential.push({ keyword: item.word, score: item.score, variants: [] });
            }
        }
    }
    
    // Sort
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

  private parseLineResponse(response: string): { word: string; score: number }[] {
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
  }
}