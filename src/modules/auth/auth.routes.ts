import { Hono } from "hono";
import { getDb } from "../../db";
import { getHasher } from "../../lib/hashing";
import * as authService from "./auth.service";
import { generateSignupToken, verifySignupToken } from "../../lib/jwt";

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
};

const authRouter = new Hono<{ Bindings: Bindings }>();

// 1. Request Signup (Stateless)
authRouter.post("/signup/request", async (c) => {
  const { email, password, name } = await c.req.json();
  const hasher = getHasher(c.env);
  
  // Hash password immediately so we don't send plain password in token
  const passwordHash = await hasher.hash(password);

  // Create stateless token
  const token = await generateSignupToken({ email, passwordHash, name });

  // Detect base URL dynamically from request
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const verifyUrl = `${baseUrl}/api/auth/signup/verify?token=${token}`;
  
  console.log(`\n>>> Verify Signup: ${verifyUrl} <<<
`);

  return c.json({ message: "Verification email sent (check console)", token }); // returning token for ease of testing
});

// 2. Verify Signup (Create User)
authRouter.get("/signup/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const payload = await verifySignupToken(token);
  if (!payload) return c.json({ error: "Invalid or expired token" }, 400);

  const db = getDb(c.env.DATABASE_URL);
  
  try {
    const user = await authService.createUser(db, {
      email: payload.email as string,
      passwordHash: payload.passwordHash as string,
      name: payload.name as string,
    });
    
    return c.json({ message: "User created successfully", user });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// 3. Login
authRouter.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const db = getDb(c.env.DATABASE_URL);
  const hasher = getHasher(c.env);

  try {
    const result = await authService.loginUser(db, hasher, email, password);
    return c.json(result);
  } catch (err) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
});

export { authRouter };
