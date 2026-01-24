import { YouTubeService } from "../src/modules/youtube/YouTubeService";

async function run() {
  const service = new YouTubeService();
  const url = "https://www.youtube.com/watch?v=I8wgbma_OOA";
  
  console.log("Testing URL:", url);
  
  const videoId = service.extractVideoId(url);
  console.log("Extracted Video ID:", videoId);
  
  if (videoId) {
    try {
      console.log("Fetching transcript...");
      const result = await service.getTranscript(videoId);
      if (result) {
        console.log("Success!");
        console.log("Title:", result.title);
        console.log("Transcript length:", result.text.length);
      } else {
        console.error("Failed: getTranscript returned null");
      }
    } catch (e) {
      console.error("Crash during fetch:", e);
    }
  } else {
    console.error("Failed to extract Video ID");
  }
}

run();
