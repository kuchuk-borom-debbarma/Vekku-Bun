import { Hono } from "hono";
import { getDb } from "../../db";
import { getHasher } from "../../lib/hashing";
import * as authService from "./auth.service";

// Define the expected environment bindings
type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

const authRouter = new Hono<{ Bindings: Bindings }>();

authRouter.post("/trigger-verification", async (c) => {
  const { email } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);
  
  const token = await authService.triggerEmailVerification(db, email);
  return c.json({ token });
});

authRouter.post("/verify-email", async (c) => {
  const { token, otp, password } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);
  const hasher = getHasher(c.env);

  const success = await authService.verifyEmail(db, hasher, token, otp, password);
  return c.json({ success });
});

authRouter.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);
  const hasher = getHasher(c.env);

  const result = await authService.login(db, hasher, email, password);
  return c.json(result);
});

authRouter.post("/refresh-token", async (c) => {
  const { token } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);

  const result = await authService.refreshUserToken(db, token);
  return c.json(result);
});

export { authRouter };
