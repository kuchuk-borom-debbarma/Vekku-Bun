import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from "bun:test";

// --- Mocks ---

const mockUuid = "mock-uuid-123";
mock.module("../../util/UUID", () => ({
  generateUUID: () => mockUuid,
}));

mock.module("../../util/Jwt", () => ({
  generateAccessToken: mock(async () => "mock-access-token"),
  generateRefreshToken: mock(async () => "mock-refresh-token"),
  verifyJwt: mock(async (token: string) => 
    token === "valid-token" ? { sub: "user-id" } : null
  ),
}));

// Mock Bun.password
const hashSpy = spyOn(Bun.password, "hash").mockImplementation(async () => "hashed_password");
const verifySpy = spyOn(Bun.password, "verify").mockImplementation(async (plain, hash) => plain === "password" && hash === "hashed_password");

// Drizzle Mocks
const dbMocks = {
  returning: mock(() => [] as any[]),
  limit: mock(() => [] as any[]),
  // Chain helpers
  where: mock(() => ({
    limit: dbMocks.limit,
    returning: dbMocks.returning,
    delete: dbMocks.delete, // for delete chain if needed
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
  
  // Transaction
  transaction: mock(async (cb: any) => {
    return await cb({
        insert: dbMocks.insert,
        delete: dbMocks.delete,
        select: dbMocks.select, // In case select is used in tx
    });
  }),
};

mock.module("../../infra/Drizzle", () => ({
  db: {
    select: dbMocks.select,
    insert: dbMocks.insert,
    delete: dbMocks.delete,
    transaction: dbMocks.transaction,
  },
}));

// Import service after mocks
import { AuthServiceImpl } from "./AuthServiceImpl";

describe("AuthServiceImpl", () => {
  let service: AuthServiceImpl;

  beforeEach(() => {
    service = new AuthServiceImpl();
    
    // Clear mocks
    Object.values(dbMocks).forEach((m) => {
        if (m.mockClear) m.mockClear();
    });
    hashSpy.mockClear();
    verifySpy.mockClear();

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

      const result = await service.triggerEmailVerification("test@example.com");

      expect(dbMocks.select).toHaveBeenCalled(); // Checked user
      expect(dbMocks.insert).toHaveBeenCalled(); // Inserted verification
      expect(result).toBe("ver-id-1");
    });

    test("should throw if user already exists", async () => {
      // 1. User check returns existing user
      dbMocks.limit.mockImplementationOnce(() => [{ id: "existing-id" }]);

      await expect(service.triggerEmailVerification("test@example.com"))
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

      const result = await service.verifyEmail("valid-token", "123456", "password");

      expect(result).toBeTrue();
      expect(dbMocks.transaction).toHaveBeenCalled();
      expect(dbMocks.insert).toHaveBeenCalled(); // User created
      expect(dbMocks.delete).toHaveBeenCalled(); // Verification deleted
      expect(Bun.password.hash).toHaveBeenCalled();
    });

    test("should throw if verification token invalid/not found", async () => {
      dbMocks.limit.mockImplementationOnce(() => []); // Not found

      await expect(service.verifyEmail("bad-token", "123", "pwd"))
        .rejects.toThrow("Invalid verification token");
    });

    test("should throw if token expired", async () => {
       dbMocks.limit.mockImplementationOnce(() => [{
           ...validVerification,
           expiresAt: new Date(Date.now() - 1000), // Past
       }]);

       await expect(service.verifyEmail("token", "123456", "pwd"))
         .rejects.toThrow("Verification token expired");
    });

    test("should throw if OTP mismatch", async () => {
        dbMocks.limit.mockImplementationOnce(() => [{
            ...validVerification,
            otp: "999999",
        }]);
 
        await expect(service.verifyEmail("token", "123456", "pwd"))
          .rejects.toThrow("Invalid OTP");
     });

     test("should throw if email already used (race condition)", async () => {
        // 1. Verification found
        dbMocks.limit.mockImplementationOnce(() => [validVerification]);
        // 2. User check -> found!
        dbMocks.limit.mockImplementationOnce(() => [{ id: "u1" }]);

        await expect(service.verifyEmail("token", "123456", "pwd"))
          .rejects.toThrow("Email already in use");
     });
  });

  describe("login", () => {
      test("should return tokens on valid credentials", async () => {
          const mockUser = { id: "u1", username: "test@example.com", password: "hashed_password" };
          dbMocks.limit.mockImplementationOnce(() => [mockUser]);

          const result = await service.login("test@example.com", "password");

          expect(result).toEqual({ accessToken: "mock-access-token", refreshToken: "mock-refresh-token" });
          expect(Bun.password.verify).toHaveBeenCalled();
      });

      test("should throw on user not found", async () => {
          dbMocks.limit.mockImplementationOnce(() => []);
          
          await expect(service.login("test@example.com", "pwd"))
            .rejects.toThrow("Invalid email or password");
      });

      test("should throw on invalid password", async () => {
        const mockUser = { id: "u1", username: "test@example.com", password: "hashed_password" };
        dbMocks.limit.mockImplementationOnce(() => [mockUser]);
        
        // Mock verify to return false
        (Bun.password.verify as any).mockResolvedValueOnce(false);

        await expect(service.login("test@example.com", "wrong-pwd"))
          .rejects.toThrow("Invalid email or password");
      });
  });

  describe("refreshToken", () => {
      test("should return new tokens for valid refresh token", async () => {
          // VerifyJwt mock returns { sub: "user-id" } for "valid-token"
          
          // User exists check
          dbMocks.limit.mockImplementationOnce(() => [{ id: "user-id" }]);

          const result = await service.refreshToken("valid-token");
          
          expect(result).toEqual({ accessToken: "mock-access-token", refreshToken: "mock-refresh-token" });
      });

      test("should throw for invalid token", async () => {
          await expect(service.refreshToken("invalid-token"))
            .rejects.toThrow("Invalid refresh token");
      });

      test("should throw if user no longer exists", async () => {
         // User check returns empty
         dbMocks.limit.mockImplementationOnce(() => []);

         await expect(service.refreshToken("valid-token"))
           .rejects.toThrow("User not found");
      });
  });

});
