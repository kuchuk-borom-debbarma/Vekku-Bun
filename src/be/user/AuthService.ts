import { eq } from "drizzle-orm";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { user } from "./_internal/entities/UserEntity";
import { userVerification } from "./_internal/entities/VerificationEntity";
import { generateUUID } from "../util/UUID";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyJwt,
} from "../util/Jwt";
import type { IHasher } from "../infra/hashing/IHasher";
import type { IAuthService } from "./IAuthService";

export class AuthService implements IAuthService {
  constructor(
    private db: NeonHttpDatabase,
    private hasher: IHasher
  ) {}

  async triggerEmailVerification(email: string): Promise<string> {
    const result = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, email))
      .limit(1);

    if (result.length > 0) {
      throw new Error("User with this email already exists");
    }

    const saved = await this.db
      .insert(userVerification)
      .values({
        email,
        otp: "123456",
        id: generateUUID(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      })
      .returning({ id: userVerification.id });

    if (!saved[0]) {
      throw new Error("Failed to save verification");
    }

    return saved[0].id;
  }

  async verifyEmail(
    token: string,
    otp: string,
    password: string,
  ): Promise<boolean> {
    const verifications = await this.db
      .select()
      .from(userVerification)
      .where(eq(userVerification.id, token))
      .limit(1);

    const verification = verifications[0];

    if (!verification) {
      throw new Error("Invalid verification token");
    }

    if (new Date() > verification.expiresAt) {
      throw new Error("Verification token expired");
    }

    if (verification.otp !== otp) {
      throw new Error("Invalid OTP");
    }

    const existingUser = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, verification.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Email already in use");
    }

    const hashedPassword = await this.hasher.hash(password);

    await this.db.batch([
      this.db.insert(user).values({
        id: generateUUID(),
        username: verification.email,
        password: hashedPassword,
        createdAt: new Date(),
        is_deleted: false,
      }),
      this.db.delete(userVerification).where(eq(userVerification.email, verification.email)),
    ]);

    return true;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const foundUser = await this.db
      .select()
      .from(user)
      .where(eq(user.username, email))
      .limit(1);

    const u = foundUser[0];

    if (!u) {
      throw new Error("Invalid email or password");
    }

    const valid = await this.hasher.verify(password, u.password);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const accessToken = await generateAccessToken(u.id);
    const refreshToken = await generateRefreshToken(u.id);

    return { accessToken, refreshToken };
  }

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await verifyJwt(token);
    if (!payload || !payload.sub) {
      throw new Error("Invalid refresh token");
    }

    const userId = payload.sub as string;

    // Optional: Verify user exists and is not banned
    const foundUser = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (foundUser.length === 0) {
      throw new Error("User not found");
    }

    const newAccessToken = await generateAccessToken(userId);
    const newRefreshToken = await generateRefreshToken(userId);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}