// Minimal stopword list to filter out noise
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
]);

/**
 * Clean text: lowercase, remove punctuation, keep only alphanumeric and spaces
 */
function cleanText(text: string): string {
  // Replace non-alphanumeric (excluding spaces) with space
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") 
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate N-grams from text, ranked by frequency
 */
export function extractCandidates(text: string, ngramRange: [number, number] = [1, 2], limit: number = 50): string[] {
  const cleaned = cleanText(text);
  const words = cleaned.split(" ").filter(w => w.length > 0);
  const candidateCounts = new Map<string, number>();

  if (words.length === 0) return [];

  const letterRegex = /[a-z]/; // At least one letter required

  for (let n = ngramRange[0]; n <= ngramRange[1]; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n);
      const phraseStr = phrase.join(" ");
      
      // STRICT FILTERING:
      // 1. Must contain at least one letter (don't suggest pure numbers or noise)
      if (!letterRegex.test(phraseStr)) continue;

      // 2. Skip if it's too short overall
      if (phraseStr.length < 3 && phrase.length === 1) continue;
      
      // 3. Skip if the WHOLE phrase is just one stopword
      if (phrase.length === 1 && STOPWORDS.has(phrase[0]!)) continue;

      // 4. For multi-word phrases, ensure at least one word isn't a stopword
      if (phrase.length > 1) {
        const allStopwords = phrase.every(w => STOPWORDS.has(w));
        if (allStopwords) continue;
      }

      candidateCounts.set(phraseStr, (candidateCounts.get(phraseStr) || 0) + 1);
    }
  }

  // Sort by frequency (desc) then by length (desc)
  const sorted = Array.from(candidateCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  
  return Array.from(new Set(sorted.slice(0, limit).map(x => x[0])));
}

/**
 * Calculate dynamic keyword limit based on word count
 */
export function calculateKeywordLimit(text: string): number {
  const wordCount = text.split(/\s+/).length;
  // Base 5, +1 for every 100 words, Cap at 15
  const extra = Math.floor(wordCount / 100);
  return Math.min(5 + extra, 15);
}
