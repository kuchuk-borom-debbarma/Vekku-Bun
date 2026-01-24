// Expanded stopword list to filter out noise more aggressively
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "really", "very", "quite", "just", "actually", "basically", "literally", "simply", "possibly", "maybe", "probably", "definitely", "highly", "mostly", "usually", "often", "always", "never",
  "get", "got", "go", "goes", "went", "gone", "make", "makes", "made", "take", "takes", "took", "taken", "see", "sees", "saw", "seen", "know", "knows", "knew", "known", "think", "thinks", "thought", "look", "looks", "looked", "want", "wants", "wanted", "use", "uses", "used", "find", "finds", "found", "give", "gives", "gave", "given", "tell", "tells", "told", "work", "works", "worked", "call", "calls", "called", "try", "trys", "tried", "keep", "keeps", "kept", "help", "helps", "helped", "show", "shows", "showed", "feel", "feels", "felt", "mean", "means", "meant", "let", "lets", "seem", "seems", "seemed", "become", "becomes", "became", "become", "happen", "happens", "happened", "need", "needs", "needed", "like", "likes", "liked", "love", "loves", "loved"
]);

/**
 * Clean text: remove timestamps, lowercase, remove punctuation, keep only alphanumeric and spaces
 */
function cleanText(text: string): string {
  // 1. Remove YouTube timestamps (e.g., 00:00:00.000 or 00:00)
  const withoutTimestamps = text.replace(/\d{1,2}:\d{2}(:\d{2}(\.\d{3})?)?/g, " ");

  // 2. Lowercase and remove non-alphanumeric (excluding spaces)
  const basicClean = withoutTimestamps
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") 
    .replace(/\s+/g, " ")
    .trim();

  // 3. Filter out purely numeric tokens (like "00", "123")
  return basicClean
    .split(" ")
    .filter(word => /[a-z]/.test(word)) // Must contain at least one letter
    .join(" ");
}

/**
 * Generate N-grams from text, ranked by frequency
 */
export function extractCandidates(text: string, ngramRange: [number, number] = [1, 3], limit: number = 50): string[] {
  const cleaned = cleanText(text);
  const words = cleaned.split(" ").filter(w => w.length > 0);
  const candidateCounts = new Map<string, number>();

  if (words.length === 0) return [];

  const letterRegex = /[a-z]/;

  for (let n = ngramRange[0]; n <= ngramRange[1]; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      let phrase = words.slice(i, i + n);
      
      // TRIM STRATEGY:
      // Remove leading and trailing stopwords from the phrase
      // E.g. "the hotel" -> "hotel", "will go" -> [] (if both are stopwords)
      while (phrase.length > 0 && STOPWORDS.has(phrase[0]!)) {
        phrase = phrase.slice(1);
      }
      while (phrase.length > 0 && STOPWORDS.has(phrase[phrase.length - 1]!)) {
        phrase = phrase.slice(0, -1);
      }

      if (phrase.length === 0) continue;

      const phraseStr = phrase.join(" ");
      
      // STRICT FILTERING:
      // 1. Must contain at least one letter
      if (!letterRegex.test(phraseStr)) continue;

      // 2. Skip if it's too short
      if (phraseStr.length < 3) continue;
      
      // 3. Skip if the whole phrase is just one stopword (redundant due to trim logic but safe)
      if (phrase.length === 1 && STOPWORDS.has(phrase[0]!)) continue;

      candidateCounts.set(phraseStr, (candidateCounts.get(phraseStr) || 0) + 1);
    }
  }

  // Sort by frequency (desc) then by length (desc)
  const sorted = Array.from(candidateCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  
  // Return unique candidates after deduplication (since trimming might create duplicates)
  return Array.from(new Set(sorted.map(x => x[0]))).slice(0, limit);
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
