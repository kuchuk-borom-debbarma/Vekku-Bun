import { eq } from "drizzle-orm";
import { type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import { generateAccessToken, generateRefreshToken } from "../../lib/jwt";
import type { IHasher } from "../../lib/hashing";
import type { AuthUser, IAuthService } from "./AuthService";

export class AuthServiceImpl implements IAuthService {
  constructor(private db: NeonHttpDatabase<typeof schema>) {}

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }): Promise<{ id: string } | undefined> {
    const existing = await this.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, data.email))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("User already exists");
    }

    const result = await this.db
      .insert(schema.user)
      .values({
        id: generateUUID(),
        username: data.email,
        password: data.passwordHash,
        name: data.name,
        role: data.role || "user",
        isDeleted: false,
        createdAt: new Date(),
      })
      .returning();

    return result[0];
  }

  async loginUser(
    hasher: IHasher,
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const users = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.username, email))
      .limit(1);

    const u = users[0];
    if (!u || u.isDeleted) {
      throw new Error("Invalid credentials");
    }

    const valid = await hasher.verify(password, u.password);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const accessToken = await generateAccessToken(u.id);
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
