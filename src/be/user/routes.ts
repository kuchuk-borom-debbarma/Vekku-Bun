import { Hono } from "hono";
import { type Variables } from "../../context";

const userRouter = new Hono<{ Variables: Variables }>();

userRouter.post("/trigger-verification", async (c) => {
  const { email } = await c.req.json();
  const authService = c.get("authService");
  const token = await authService.triggerEmailVerification(email);
  return c.json({ token });
});

userRouter.post("/verify-email", async (c) => {
  const { token, otp, password } = await c.req.json();
  const authService = c.get("authService");
  const success = await authService.verifyEmail(token, otp, password);
  return c.json({ success });
});

userRouter.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const authService = c.get("authService");
  const result = await authService.login(email, password);
  return c.json(result);
});

userRouter.post("/refresh-token", async (c) => {
  const { token } = await c.req.json();
  const authService = c.get("authService");
  const result = await authService.refreshToken(token);
  return c.json(result);
});

export { userRouter };
