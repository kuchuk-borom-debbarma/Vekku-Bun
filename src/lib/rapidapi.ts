let rapidApiConfig: { apiKey?: string } = {};

export const setRapidApiConfig = (config: { apiKey?: string }) => {
  rapidApiConfig = config;
};

export const getRapidApiClient = () => {
  const apiKey = rapidApiConfig.apiKey;
  if (!apiKey) {
    console.warn("[RapidAPI] API Key not configured.");
  }

  return {
    /**
     * Fetches transcript using a RapidAPI service.
     * Defaulting to 'youtube-transcriptor' but designed to be adaptable.
     */
    fetchTranscript: async (videoId: string) => {
      if (!apiKey) throw new Error("RapidAPI Key missing");

      // API: https://rapidapi.com/logicbuilder/api/youtube-transcriptor
      const url = `https://youtube-transcriptor.p.rapidapi.com/transcript?video_id=${videoId}&lang=en`;
      
      console.log(`[RapidAPI] Fetching transcript for ${videoId}...`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "youtube-transcriptor.p.rapidapi.com",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`RapidAPI Failed: ${response.status} ${response.statusText} - ${errText}`);
      }

      // Response format is typically JSON array of objects or text
      // youtube-transcriptor returns: [{text: "...", start: 0, duration: 1}, ...]
      const data = await response.json() as any[];
      
      if (Array.isArray(data)) {
        return data.map((item: any) => item.text).join(" ");
      }
      
      throw new Error("Unexpected response format from RapidAPI");
    }
  };
};
