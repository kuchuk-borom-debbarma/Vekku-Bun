import { YoutubeTranscript } from "youtube-transcript";

export class YouTubeService {
  /**
   * Extracts the video ID from various YouTube URL formats.
   * Supports:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://youtube.com/embed/VIDEO_ID
   */
  extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Fetches the transcript for a given video ID and combines it into a single string.
   */
  async getTranscript(videoId: string): Promise<{ title: string; text: string } | null> {
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      // Combine all text parts
      const fullText = transcriptItems
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // Since the library doesn't fetch the title, we'll try to fetch the video page metadata
      // A simple fetch to the oembed endpoint is usually the easiest/cleanest way without an API key
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      let title = `YouTube Video (${videoId})`;
      
      try {
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const data = await oembedRes.json() as any;
          if (data.title) title = data.title;
        }
      } catch (e) {
        console.warn(`[YouTubeService] Failed to fetch metadata for ${videoId}`, e);
      }

      return {
        title,
        text: fullText,
      };
    } catch (error) {
      console.error(`[YouTubeService] Failed to fetch transcript for ${videoId}:`, error);
      throw new Error("Could not fetch transcript. The video might not have captions enabled or is restricted.");
    }
  }
}

export const getYouTubeService = () => new YouTubeService();
