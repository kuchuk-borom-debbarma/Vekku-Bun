import { sign, verify } from "hono/jwt";

const SECRET_KEY = process.env.JWT_SECRET || "default-secret-key-change-it";

export const generateAccessToken = async (userId: string) => {
  const payload = {
    sub: userId,
    role: "user",
    exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
  };
  return await sign(payload, SECRET_KEY);
};

export const generateRefreshToken = async (userId: string) => {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };
  return await sign(payload, SECRET_KEY);
};

export const verifyJwt = async (token: string) => {
  try {
    return await verify(token, SECRET_KEY);
  } catch (_) {
    return null;
  }
};
