// Minimal stopword list to filter out noise
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
]);

/**
 * Clean text: lowercase, remove punctuation
 */
function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Generate N-grams from text, ranked by frequency
 */
export function extractCandidates(text: string, ngramRange: [number, number] = [1, 2], limit: number = 50): string[] {
  const cleaned = cleanText(text);
  const words = cleaned.split(" ");
  const candidateCounts = new Map<string, number>();

  for (let n = ngramRange[0]; n <= ngramRange[1]; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n);
      const phraseStr = phrase.join(" ");
      
      // Filter: No stopwords allowed in keywords.
      const hasStopword = phrase.some(w => STOPWORDS.has(w) || w.length < 3);
      if (!hasStopword) {
        candidateCounts.set(phraseStr, (candidateCounts.get(phraseStr) || 0) + 1);
      }
    }
  }

  // Sort by frequency (desc)
  const sorted = Array.from(candidateCounts.entries()).sort((a, b) => b[1] - a[1]);
  
  // Return top N
  return sorted.slice(0, limit).map(x => x[0]);
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
