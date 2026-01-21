export interface NotificationTarget {
  id: string;      // Internal User ID or unique identifier
  email?: string;  // Email address
  phone?: string;  // Optional phone for SMS
}

export interface SendNotificationParams {
  target: NotificationTarget;
  subject: string;
  body: string;
  metadata?: Record<string, any>; // For impl-specific stuff like templateId, push tokens, etc.
}

export interface INotificationService {
  send(params: SendNotificationParams): Promise<void>;
}

let notificationConfig: { clientId?: string; clientSecret?: string } = {};

export const setNotificationConfig = (config: {
  clientId?: string;
  clientSecret?: string;
}) => {
  notificationConfig = config;
};

const localNotificationService: INotificationService = {
  send: async (params: SendNotificationParams): Promise<void> => {
    console.log("[Notification] (Local) Sending Notification:");
    console.log(`  Target: ${params.target.id} <${params.target.email || "N/A"}>`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Body: ${params.body}`);
    if (params.metadata) {
      console.log(`  Metadata:`, params.metadata);
    }
  },
};

const notificationAPIService: INotificationService = {
  send: async (params: SendNotificationParams): Promise<void> => {
    const { clientId, clientSecret } = notificationConfig;

    if (!clientId || !clientSecret) {
      throw new Error(
        "NotificationAPI credentials (CLIENT_ID or CLIENT_SECRET) are missing."
      );
    }

    const url = `https://api.notificationapi.com/${clientId}/sender`;
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    // Exact structure from user's CURL command
    const finalBody = {
        type: params.metadata?.type || "vekku",
        to: {
            id: params.target.id,
            email: params.target.email,
            number: params.target.phone 
        },
        templateId: params.metadata?.templateId || "sign_up_link",
        parameters: {
             subject: params.subject,
             body: params.body,
             ...params.metadata?.params,
        }
    };

    console.log("-----------------------------------------");
    console.log("[Notification] Sending Request...");
    console.log(`[Notification] URL: ${url}`);
    console.log(`[Notification] Auth: Basic ${basicAuth.substring(0, 5)}... (redacted)`);
    console.log(`[Notification] Body: ${JSON.stringify(finalBody, null, 2)}`);
    console.log("-----------------------------------------");

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${basicAuth}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(finalBody)
        });

        const responseText = await response.text();
        console.log(`[Notification] API Response Status: ${response.status}`);
        console.log(`[Notification] API Response Body: ${responseText}`);
        console.log("-----------------------------------------");

        if (!response.ok) {
            throw new Error(`NotificationAPI failed (${response.status}): ${responseText}`);
        }

    } catch (error) {
        console.error("[Notification] Request Failed:", error);
        throw error;
    }
  },
};

export const getNotificationService = (): INotificationService => {
  const hasCreds = notificationConfig.clientId && notificationConfig.clientSecret;

  console.log("[Notification] Factory Check:", {
    hasClientId: !!notificationConfig.clientId,
    hasClientSecret: !!notificationConfig.clientSecret,
    usingService: hasCreds ? "NotificationAPI" : "LocalFallback"
  });

  if (hasCreds) {
    return notificationAPIService;
  }

  return localNotificationService;
};
