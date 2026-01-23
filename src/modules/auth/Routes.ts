import { Hono } from "hono";
import { getHasher } from "../../lib/hashing";
import { getAuthService } from "./index";
import { generateSignupToken, verifySignupToken, verifyJwt } from "../../lib/jwt";
import { getNotificationService } from "../../lib/notification";

type Bindings = {
  DATABASE_URL: string;
  WORKER?: string;
  FRONTEND_URL?: string;
};

const authRouter = new Hono<{ Bindings: Bindings }>();

// 1. Request Signup (Stateless)
authRouter.post("/signup/request", async (c) => {
  const { email, password, name } = await c.req.json();
  const authService = getAuthService();

  // Check if user already exists
  const exists = await authService.checkUserExists(email);
  if (exists) {
    return c.json({ error: "User with this email already exists" }, 409);
  }

  const hasher = getHasher(c.env);
  
  // Hash password immediately so we don't send plain password in token
  const passwordHash = await hasher.hash(password);

  // Create stateless token
  const token = await generateSignupToken({ email, passwordHash, name });

  // Use FRONTEND_URL from env or default to localhost
  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
  const verifyUrl = `${frontendUrl}/verify?token=${token}`;
  
  console.log(`\n>>> Verify Signup: ${verifyUrl} <<<\n`);

  // Send Notification
  const notificationService = getNotificationService();
  await notificationService.send({
    target: {
      id: email, // Use email as placeholder ID for new user
      email: email,
    },
    subject: "Verify your Vekku account",
    body: `Please click here to verify your account: ${verifyUrl}`,
    metadata: {
      templateId: "sign_up_link",
      params: {
        url: verifyUrl,
        name: name,
      },
    },
  });

  return c.json({ message: "Verification email sent" });
});

// 2. Verify Signup (Create User)
authRouter.get("/signup/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const payload = await verifySignupToken(token);
  if (!payload) return c.json({ error: "Invalid or expired token" }, 400);

  const authService = getAuthService();
  
  try {
    const user = await authService.createUser({
      email: payload.email as string,
      passwordHash: payload.passwordHash as string,
      name: payload.name as string,
    });
    
    return c.json({ message: "User created successfully. You can now log in." });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// 3. Login
authRouter.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const hasher = getHasher(c.env);
  const authService = getAuthService();

  try {
    const result = await authService.loginUser(hasher, email, password);
    return c.json(result);
  } catch (err) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
});

// 4. Refresh Token
authRouter.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json();
  const authService = getAuthService();

  if (!refreshToken) {
    return c.json({ error: "Missing refresh token" }, 400);
  }

  try {
    const result = await authService.refreshToken(refreshToken);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }
});

// 5. Get Current User (Me)
authRouter.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload || !payload.sub) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const authService = getAuthService();
  const user = await authService.getUserById(payload.sub as string);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

export { authRouter };