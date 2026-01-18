import { describe, expect, test, mock, beforeEach } from "bun:test";
import { AuthServiceImpl } from "./AuthServiceImpl";

// --- Mocks ---
const mockUuid = "mock-uuid-123";
const mockAccessToken = "mock-access-token";
const mockRefreshToken = "mock-refresh-token";
const mockPayload = { sub: "u1" };

mock.module("../../lib/uuid", () => ({
  generateUUID: () => mockUuid,
}));

mock.module("../../lib/jwt", () => ({
  generateAccessToken: mock(async () => mockAccessToken),
  generateRefreshToken: mock(async () => mockRefreshToken),
  verifyJwt: mock(async (token) => (token === "valid-token" ? mockPayload : null)),
}));

// Mock Database
const createMockQuery = (data: any) => {
  const query = Promise.resolve(data) as any;
  query.where = mock(() => query);
  query.limit = mock(() => query);
  query.from = mock(() => query);
  query.select = mock(() => query);
  return query;
};

const mockDb = {
  select: mock(() => createMockQuery([])),
};

describe("AuthService", () => {
  let authService: AuthServiceImpl;

  beforeEach(() => {
    authService = new AuthServiceImpl(mockDb as any);
    mockDb.select.mockClear();
  });

  describe("refreshToken", () => {
    test("should refresh tokens for valid user", async () => {
      // Mock User Found
      const mockUser = {
        id: "u1",
        username: "test@example.com",
        password: "hash",
        name: "Test User",
        role: "USER",
        isDeleted: false,
      };
      mockDb.select.mockImplementationOnce(() => createMockQuery([mockUser]));

      const result = await authService.refreshToken("valid-token");

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.user.id).toBe("u1");
    });

    test("should throw error for invalid token", async () => {
      expect(authService.refreshToken("invalid-token")).rejects.toThrow("Invalid or expired refresh token");
    });

    test("should throw error if user not found", async () => {
      // Mock User Not Found (empty array)
      mockDb.select.mockImplementationOnce(() => createMockQuery([]));

      expect(authService.refreshToken("valid-token")).rejects.toThrow("User not found or unavailable");
    });

    test("should throw error if user is deleted", async () => {
      // Mock User Deleted
      const mockUser = {
        id: "u1",
        isDeleted: true,
      };
      mockDb.select.mockImplementationOnce(() => createMockQuery([mockUser]));

      expect(authService.refreshToken("valid-token")).rejects.toThrow("User not found or unavailable");
    });
  });
});
