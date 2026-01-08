import { describe, expect, test, mock, beforeEach } from "bun:test";
import * as authService from "./auth.service";

// --- Mocks ---

const mockUuid = "mock-uuid-123";
mock.module("../../lib/uuid", () => ({
  generateUUID: () => mockUuid,
}));

mock.module("../../lib/jwt", () => ({
  generateAccessToken: mock(async () => "mock-access-token"),
  generateRefreshToken: mock(async () => "mock-refresh-token"),
  verifyJwt: mock(async (token: string) => 
    token === "valid-token" ? { sub: "user-id" } : null
  ),
}));

// Mock Hasher
const mockHasher = {
    hash: mock(async () => "hashed_password"),
    verify: mock(async (plain: string, hash: string) => plain === "password" && hash === "hashed_password"),
};

// Drizzle Mocks
const dbMocks = {
  returning: mock(() => [] as any[]),
  limit: mock(() => [] as any[]),
  // Chain helpers
  where: mock(() => ({
    limit: dbMocks.limit,
    returning: dbMocks.returning,
    delete: dbMocks.delete, 
  })),
  values: mock(() => ({
    returning: dbMocks.returning,
  })),
  from: mock(() => ({
    where: dbMocks.where,
    limit: dbMocks.limit,
  })),
  
  // Main methods
  select: mock(() => ({ from: dbMocks.from })),
  insert: mock(() => ({ values: dbMocks.values })),
  delete: mock(() => ({ where: dbMocks.where })),
  
  // Transaction/Batch
  batch: mock(async (_cb: any) => {
    return [];
  }),
};

// Construct the mock DB object
const mockDb = {
    select: dbMocks.select,
    insert: dbMocks.insert,
    delete: dbMocks.delete,
    batch: dbMocks.batch,
} as any;

describe("AuthService", () => {
  beforeEach(() => {
    // Clear mocks
    Object.values(dbMocks).forEach((m) => {
        if (m.mockClear) m.mockClear();
    });
    mockHasher.hash.mockClear();
    mockHasher.verify.mockClear();

    // Default return for limit (select queries)
    dbMocks.limit.mockImplementation(() => []);
    // Default return for returning (insert/update queries)
    dbMocks.returning.mockImplementation(() => []);
  });

  describe("triggerEmailVerification", () => {
    test("should create verification if user does not exist", async () => {
      // 1. User check returns empty (user doesn't exist)
      dbMocks.limit.mockImplementationOnce(() => []);
      
      // 2. Insert returns created verification
      dbMocks.returning.mockImplementationOnce(() => [{ id: "ver-id-1" }]);

      const result = await authService.triggerEmailVerification(mockDb, "test@example.com");

      expect(dbMocks.select).toHaveBeenCalled(); // Checked user
      expect(dbMocks.insert).toHaveBeenCalled(); // Inserted verification
      expect(result).toBe("ver-id-1");
    });

    test("should throw if user already exists", async () => {
      // 1. User check returns existing user
      dbMocks.limit.mockImplementationOnce(() => [{ id: "existing-id" }]);

      await expect(authService.triggerEmailVerification(mockDb, "test@example.com"))
        .rejects.toThrow("User with this email already exists");
        
      expect(dbMocks.insert).not.toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    const validVerification = {
        id: "valid-token",
        email: "test@example.com",
        otp: "123456",
        expiresAt: new Date(Date.now() + 10000), // Future
    };

    test("should create user and delete verification on success", async () => {
      // 1. Get verification -> success
      dbMocks.limit.mockImplementationOnce(() => [validVerification]);
      
      // 2. Check existing user -> empty
      dbMocks.limit.mockImplementationOnce(() => []);

      const result = await authService.verifyEmail(mockDb, mockHasher, "valid-token", "123456", "password");

      expect(result).toBeTrue();
      expect(dbMocks.batch).toHaveBeenCalled();
      expect(dbMocks.insert).toHaveBeenCalled(); // User created
      expect(dbMocks.delete).toHaveBeenCalled(); // Verification deleted
      expect(mockHasher.hash).toHaveBeenCalled();
    });

    test("should throw if verification token invalid/not found", async () => {
      dbMocks.limit.mockImplementationOnce(() => []); // Not found

      await expect(authService.verifyEmail(mockDb, mockHasher, "bad-token", "123", "pwd"))
        .rejects.toThrow("Invalid verification token");
    });
  });

  describe("login", () => {
      test("should return tokens on valid credentials", async () => {
          const mockUser = { id: "u1", username: "test@example.com", password: "hashed_password" };
          dbMocks.limit.mockImplementationOnce(() => [mockUser]);

          const result = await authService.login(mockDb, mockHasher, "test@example.com", "password");

          expect(result).toEqual({ accessToken: "mock-access-token", refreshToken: "mock-refresh-token" });
          expect(mockHasher.verify).toHaveBeenCalled();
      });

      test("should throw on user not found", async () => {
          dbMocks.limit.mockImplementationOnce(() => []);
          
          await expect(authService.login(mockDb, mockHasher, "test@example.com", "pwd"))
            .rejects.toThrow("Invalid email or password");
      });
  });

  describe("refreshToken", () => {
      test("should return new tokens for valid refresh token", async () => {
          // User exists check
          dbMocks.limit.mockImplementationOnce(() => [{ id: "user-id" }]);

          const result = await authService.refreshUserToken(mockDb, "valid-token");
          
          expect(result).toEqual({ accessToken: "mock-access-token", refreshToken: "mock-refresh-token" });
      });
  });

});
