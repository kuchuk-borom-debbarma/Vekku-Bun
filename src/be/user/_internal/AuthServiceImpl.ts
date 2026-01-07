import { eq } from "drizzle-orm";
import { db } from "../../infra/Drizzle";
import { IAuthService } from "../api";
import { user } from "./entities/UserEntity";
import { userVerification } from "./entities/VerificationEntity";
import { generateUUID } from "../../util/UUID";

export class AuthServiceImpl extends IAuthService {
  override async triggerEmailVerification(email: string): Promise<string> {
    const result = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, email))
      .limit(1);

    if (result.length > 0) {
      throw new Error("User with this email already exists");
    }

    const saved = await db
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

  override async verifyEmail(
    token: string,
    otp: string,
    password: string,
  ): Promise<boolean> {
    const verifications = await db
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

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, verification.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Email already in use");
    }

    const hashedPassword = await Bun.password.hash(password);

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: generateUUID(),
        username: verification.email,
        password: hashedPassword,
        createdAt: new Date(),
        is_deleted: false,
      });

      await tx.delete(userVerification).where(eq(userVerification.email, verification.email));
    });

    return true;
  }

  override login(
    _email: string,
    _password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    throw new Error("Method not implemented.");
  }
}
