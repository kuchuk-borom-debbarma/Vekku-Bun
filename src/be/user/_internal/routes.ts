import { Hono } from "hono";
import type { IAuthService } from "../api";

export const registerUserRoutes = (router: Hono, authService: IAuthService) => {
  router.post("/trigger-verification", async (c) => {
    const { email } = await c.req.json();
    const token = await authService.triggerEmailVerification(email);
    return c.json({ token });
  });

  router.post("/verify-email", async (c) => {
    const { token, otp, password } = await c.req.json();
    const success = await authService.verifyEmail(token, otp, password);
    return c.json({ success });
  });

  router.post("/login", async (c) => {
    const { email, password } = await c.req.json();
    const result = await authService.login(email, password);
    return c.json(result);
  });

  router.post("/refresh-token", async (c) => {
    const { token } = await c.req.json();
    const result = await authService.refreshToken(token);
    return c.json(result);
  });
};
