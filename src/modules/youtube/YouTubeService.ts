import { YoutubeTranscript } from "youtube-transcript";
import { getApifyClient } from "../../lib/apify";

export class YouTubeService {
  /**
   * Extracts the video ID from various YouTube URL formats.
   */
  extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Fetches the transcript and basic metadata.
   * Strategy: Apify (Reliable) -> Local Library (Fallback)
   */
  async getTranscript(videoId: string): Promise<{ title: string; text: string } | null> {
    // 1. Try Apify (Primary)
    try {
      const apify = getApifyClient();
      console.log(`[YouTubeService] Attempting Apify fetch for ${videoId}...`);
      
      // Actor: memo/youtube-transcript-scraper
      const runResult = await apify.runActor("memo/youtube-transcript-scraper", {
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });

      if (Array.isArray(runResult) && runResult.length > 0) {
        const item = runResult[0];
        // The actor usually returns 'text' or 'transcript' and 'title'
        const text = item.text || item.transcript;
        if (text) {
             console.log(`[YouTubeService] Apify success!`);
             return {
                title: item.title || `YouTube Video (${videoId})`,
                text: text
             };
        }
      }
    } catch (e) {
      console.warn(`[YouTubeService] Apify failed:`, e);
    }

    // 2. Fallback to youtube-transcript library
    try {
      console.log(`[YouTubeService] Fallback to local library for ${videoId}...`);
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      const fullText = transcriptItems
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // Fetch oembed for title
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      let title = `YouTube Video (${videoId})`;
      
      try {
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const data = await oembedRes.json() as any;
          if (data.title) title = data.title;
        }
      } catch (e) {
        console.warn(`[YouTubeService] Failed to fetch metadata via oembed`, e);
      }

      return {
        title,
        text: fullText,
      };
    } catch (error) {
      console.error(`[YouTubeService] All methods failed for ${videoId}:`, error);
      return null;
    }
  }
}

export const getYouTubeService = () => new YouTubeService();