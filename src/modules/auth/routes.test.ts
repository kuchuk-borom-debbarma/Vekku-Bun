import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { authRouter } from "./Routes";

// --- Mocks ---
const mockToken = "mock-signup-token";
const mockSend = mock(async () => {});

mock.module("../../lib/jwt", () => ({
  generateSignupToken: mock(async () => mockToken),
  verifySignupToken: mock(async () => ({})),
  verifyJwt: mock(async () => ({})),
}));

mock.module("../../lib/notification", () => ({
  getNotificationService: () => ({
    send: mockSend,
  }),
}));

mock.module("./index", () => ({
  getAuthService: () => ({
    checkUserExists: async () => false,
  }),
}));

mock.module("../../lib/hashing", () => ({
  getHasher: () => ({
    hash: async (p: string) => "hashed-" + p,
  }),
}));


describe("Auth Routes", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  test("should use first URL from FRONTEND_URL list if Origin not present", async () => {
    const app = new Hono();
    app.route("/", authRouter);

    const env = {
      FRONTEND_URL: "http://localhost:5173, https://vekku-bun.vercel.app",
    };

    const res = await app.request("/signup/request", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "123", name: "Test" }),
      headers: { "Content-Type": "application/json" },
    }, env);

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalled();
    const sentBody = mockSend.mock.calls[0][0].body;
    expect(sentBody).toContain("http://localhost:5173/verify?token=" + mockToken);
  });

  test("should use matching Origin if in FRONTEND_URL list", async () => {
    const app = new Hono();
    app.route("/", authRouter);

    const env = {
      FRONTEND_URL: "http://localhost:5173, https://vekku-bun.vercel.app",
    };

    const res = await app.request("/signup/request", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "123", name: "Test" }),
      headers: { 
        "Content-Type": "application/json",
        "Origin": "https://vekku-bun.vercel.app"
      },
    }, env);

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalled();
    const sentBody = mockSend.mock.calls[0][0].body;
    expect(sentBody).toContain("https://vekku-bun.vercel.app/verify?token=" + mockToken);
  });

  test("should fallback to first URL if Origin does not match allowed list", async () => {
    const app = new Hono();
    app.route("/", authRouter);

    const env = {
      FRONTEND_URL: "http://localhost:5173, https://vekku-bun.vercel.app",
    };

    const res = await app.request("/signup/request", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "123", name: "Test" }),
      headers: { 
        "Content-Type": "application/json",
        "Origin": "https://evil.com"
      },
    }, env);

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalled();
    const sentBody = mockSend.mock.calls[0][0].body;
    expect(sentBody).toContain("http://localhost:5173/verify?token=" + mockToken);
  });

   test("should handle single FRONTEND_URL correctly", async () => {
    const app = new Hono();
    app.route("/", authRouter);

    const env = {
      FRONTEND_URL: "https://single.com",
    };

    const res = await app.request("/signup/request", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "123", name: "Test" }),
      headers: { "Content-Type": "application/json" },
    }, env);

    expect(res.status).toBe(200);
    
    // Fix: variable 'sentBody' is not defined in this scope, need to retrieve it again
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.body).toContain("https://single.com/verify?token=" + mockToken);
  });
});
