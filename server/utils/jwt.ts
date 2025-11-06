import jwt from "jsonwebtoken";
import crypto from "crypto";

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production. Please set a secure random string (min 32 characters).");
  }
  
  // Development only: Generate a random secret and warn
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("⚠️  WARNING: JWT_SECRET not set. Using randomly generated secret for development.");
  console.warn("⚠️  For production, set JWT_SECRET environment variable to a secure random string.");
  console.warn(`⚠️  Generated secret (save this if you need consistent sessions): ${JWT_SECRET}`);
}

// Token TTL from environment (default: 15m access, 30d refresh)
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

export interface JWTPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JWTPayload, type: "access" | "refresh" = "access"): string {
  const expiresIn = type === "access" ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}
