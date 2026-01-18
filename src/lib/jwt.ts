import { sign, verify } from "hono/jwt";

// Fallback is for dev only. In prod, ensure JWT_SECRET is set via setJwtSecret.
let SECRET_KEY = "default-secret-key-change-it";

export const setJwtSecret = (secret: string) => {
  SECRET_KEY = secret;
};

export const generateSignupToken = async (data: Record<string, any>) => {
  const payload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
  };
  return await sign(payload, SECRET_KEY);
};

export const verifySignupToken = async (token: string) => {
  try {
    return await verify(token, SECRET_KEY);
  } catch (_) {
    return null;
  }
};

export const generateAccessToken = async (userId: string) => {
  const payload = {
    sub: userId,
    role: "USER",
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
