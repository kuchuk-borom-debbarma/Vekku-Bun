let apifyConfig: { apiToken?: string } = {};

export const setApifyConfig = (config: { apiToken?: string }) => {
  apifyConfig = config;
};

export const getApifyClient = () => {
  const token = apifyConfig.apiToken;
  if (!token) {
    console.warn("[Apify] API Token not configured. Calls will fail.");
  }

  return {
    runActor: async (actorId: string, input: any) => {
      if (!token) throw new Error("Apify API Token missing");

      const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
      console.log(`[Apify] Running actor ${actorId}...`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Apify Actor Failed: ${response.status} ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      return data;
    }
  };
};
