import { YoutubeTranscript } from "youtube-transcript";

async function run() {
  const videoId = "dQw4w9WgXcQ";
  try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      console.log("Items count:", transcriptItems.length);
      console.log("First item:", transcriptItems[0]);
  } catch (e) {
      console.error("Library Error:", e);
  }
}

run();
