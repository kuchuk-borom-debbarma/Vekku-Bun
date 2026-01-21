import notificationapi from "notificationapi-node-server-sdk";

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

    notificationapi.init(clientId, clientSecret);

    try {
      // Mapping the generic interface to NotificationAPI's specific structure
      // We prioritize metadata.templateId if present, otherwise we assume a default or use the subject/body as parameters.
      await notificationapi.send({
        notificationId: params.metadata?.templateId || "default_notification",
        to: {
          id: params.target.id,
          email: params.target.email,
        },
        parameters: {
          subject: params.subject,
          body: params.body,
          ...params.metadata?.params,
        },
        // Support for 'sub-type' or 'type' if provided in metadata
        // The snippet used 'type', but SDK often uses 'subNext' or similar depending on version.
        // We'll stick to what worked in the snippet.
        // @ts-ignore
        type: params.metadata?.type || "vekku",
      });
    } catch (error) {
      console.error("Failed to send notification via NotificationAPI:", error);
      throw error;
    }
  },
};

export const getNotificationService = (): INotificationService => {
  const hasCreds = notificationConfig.clientId && notificationConfig.clientSecret;

  if (hasCreds) {
    return notificationAPIService;
  }

  return localNotificationService;
};