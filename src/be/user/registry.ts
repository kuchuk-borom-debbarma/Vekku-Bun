import { Hono } from "hono";
import { registerRoutes, type AppContext } from "../infra/AppRegistry.ts";
import { AuthServiceImpl } from "./_internal/AuthServiceImpl";

registerRoutes((app: Hono, { db, hasher }: AppContext) => {
  const authService = new AuthServiceImpl({ db, hasher });

  const user = app.basePath("/api/user");

  user.post("/trigger-verification", async (c) => {
    const { email } = await c.req.json();
    const token = await authService.triggerEmailVerification(email);
    return c.json({ token });
  });

  user.post("/verify-email", async (c) => {
    const { token, otp, password } = await c.req.json();
    const success = await authService.verifyEmail(token, otp, password);
    return c.json({ success });
  });

  user.post("/login", async (c) => {
    const { email, password } = await c.req.json();
    const result = await authService.login(email, password);
    return c.json(result);
  });

  user.post("/refresh-token", async (c) => {
    const { token } = await c.req.json();
    const result = await authService.refreshToken(token);
    return c.json(result);
  });
});
