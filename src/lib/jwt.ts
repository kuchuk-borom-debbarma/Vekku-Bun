import { sign, verify } from "hono/jwt";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Fallback is for dev only. In prod, ensure JWT_SECRET is set via setJwtSecret.
let SECRET_KEY = "default-secret-key-change-it";

export const setJwtSecret = (secret: string) => {
  SECRET_KEY = secret;
};

// --- Encryption Helpers ---
const ALGORITHM = "aes-256-cbc";
const SALT = "salt"; // Simple fixed salt for deterministic key derivation from secret

const getKey = () => scryptSync(SECRET_KEY, SALT, 32);

const encryptData = (data: any): string => {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

const decryptData = (encryptedData: string): any => {
  const [ivHex, encryptedHex] = encryptedData.split(":");
  if (!ivHex || !encryptedHex) throw new Error("Invalid encrypted data format");
  
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
};
// --------------------------

export const generateSignupToken = async (data: Record<string, any>) => {
  const encryptedPayload = encryptData(data);
  const jwtPayload = {
    payload: encryptedPayload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
  };
  return await sign(jwtPayload, SECRET_KEY);
};

export const verifySignupToken = async (token: string) => {
  try {
    const decoded = await verify(token, SECRET_KEY);
    if (!decoded || !decoded.payload) return null;
    
    return decryptData(decoded.payload as string);
  } catch (_) {
    return null;
  }
};

export const generateAccessToken = async (userId: string, role: string = "USER") => {
  const payload = {
    sub: userId,
    role: role,
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
