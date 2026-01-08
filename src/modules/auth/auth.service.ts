import { eq } from "drizzle-orm";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema";
import { generateUUID } from "../../lib/uuid";
import { generateAccessToken, generateRefreshToken } from "../../lib/jwt";
import type { IHasher } from "../../lib/hashing";

export const createUser = async (
  db: NeonHttpDatabase<typeof schema>,
  data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }
) => {
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, data.email))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("User already exists");
  }

  const result = await db
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
};

export const loginUser = async (
  db: NeonHttpDatabase<typeof schema>,
  hasher: IHasher,
  email: string,
  password: string
) => {
  const users = await db
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

  return { user: { id: u.id, name: u.name, role: u.role }, accessToken, refreshToken };
};
