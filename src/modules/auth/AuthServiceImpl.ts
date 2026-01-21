import { eq } from "drizzle-orm";
import { type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import { generateAccessToken, generateRefreshToken, verifyJwt } from "../../lib/jwt";
import type { IHasher } from "../../lib/hashing";
import type { AuthUser, IAuthService } from "./AuthService";

export class AuthServiceImpl implements IAuthService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async refreshToken(token: string): Promise<AuthUser> {
    const payload = await verifyJwt(token);
    if (!payload || !payload.sub) {
      throw new Error("Invalid or expired refresh token");
    }

    const users = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, payload.sub as string))
      .limit(1);

    const u = users[0];
    if (!u || u.isDeleted) {
      throw new Error("User not found or unavailable");
    }

    const accessToken = await generateAccessToken(u.id, u.role);
    const newRefreshToken = await generateRefreshToken(u.id);

    return {
      user: { id: u.id, name: u.name, role: u.role },
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }): Promise<{ id: string } | undefined> {
    console.log(`[AuthService] Attempting to create user: ${data.email}`);
    const existing = await this.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, data.email))
      .limit(1);

    if (existing.length > 0) {
      console.warn(`[AuthService] User creation failed - Email already exists: ${data.email}`);
      throw new Error("User already exists");
    }

    const result = await this.db
      .insert(schema.user)
      .values({
        id: generateUUID(),
        username: data.email,
        password: data.passwordHash,
        name: data.name,
        role: (data.role as "USER" | "ADMIN") || "USER",
        isDeleted: false,
        createdAt: new Date(),
      })
      .returning();

    console.log(`[AuthService] User created successfully: ${result[0]?.id}`);
    return result[0];
  }

  async loginUser(
    hasher: IHasher,
    email: string,
    password: string,
  ): Promise<AuthUser> {
    console.log(`[AuthService] Login attempt for: ${email}`);
    const users = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.username, email))
      .limit(1);

    const u = users[0];
    if (!u || u.isDeleted) {
      console.warn(`[AuthService] Login failed - User not found or deleted: ${email}`);
      throw new Error("Invalid credentials");
    }

    const valid = await hasher.verify(password, u.password);
    if (!valid) {
      console.warn(`[AuthService] Login failed - Invalid password: ${email}`);
      throw new Error("Invalid credentials");
    }

    console.log(`[AuthService] Login successful: ${u.id} (${u.name})`);
    const accessToken = await generateAccessToken(u.id, u.role);
    const refreshToken = await generateRefreshToken(u.id);

    return {
      user: { id: u.id, name: u.name, role: u.role },
      accessToken,
      refreshToken,
    };
  }

  async checkUserExists(email: string): Promise<boolean> {
    const existing = await this.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, email))
      .limit(1);

    return existing.length > 0;
  }
}
