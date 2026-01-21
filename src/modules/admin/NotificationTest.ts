import { Hono } from "hono";
import { getNotificationService } from "../../lib/notification";

const notificationTestRouter = new Hono();

notificationTestRouter.get("/test-send", async (c) => {
  const email = c.req.query("email") || "kuchukboromd@gmail.com";
  const notificationService = getNotificationService();

  console.log(`[Test] Triggering test notification to: ${email}`);

  try {
    await notificationService.send({
      target: {
        id: "test-user-id",
        email: email,
      },
      subject: "Vekku Test Notification",
      body: "If you are reading this, the Vekku notification service is working correctly!",
      metadata: {
        templateId: "sign_up_link", // Using your existing template
        params: {
          url: "https://localhost:3000/verify-test",
          name: "Vekku Tester",
        },
      },
    });

    return c.json({
      success: true,
      message: `Test notification sent to ${email}. Check your email and console.`,
    });
  } catch (error) {
    console.error("[Test] Notification failed:", error);
    return c.json({
      success: false,
      error: (error as Error).message,
    }, 500);
  }
});

export { notificationTestRouter };
