import { Request, Response, NextFunction } from "express";
import { verifyToken, signToken } from "../utils/jwt";
import type { CookieOptions } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

// Feature flag for cookie-based auth (enabled by default to fix 401 errors)
const FEATURE_TOKEN_REFRESH = process.env.FEATURE_TOKEN_REFRESH !== "false";

// Token TTLs
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

// Convert TTL string to milliseconds
function ttlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // Default 15 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/**
 * Set authentication cookies for access and refresh tokens
 */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  if (!FEATURE_TOKEN_REFRESH) {
    return; // Feature disabled
  }

  const isProduction = process.env.NODE_ENV === "production";
  
  // Access token cookie (short-lived, SameSite=Lax for API calls)
  const accessTokenOptions: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: ttlToMs(ACCESS_TOKEN_TTL),
    path: "/",
  };
  
  // Refresh token cookie (long-lived, SameSite=Strict, only for /auth routes)
  const refreshTokenOptions: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: ttlToMs(REFRESH_TOKEN_TTL),
    path: "/api/auth",
  };
  
  res.cookie("access_token", tokens.accessToken, accessTokenOptions);
  res.cookie("refresh_token", tokens.refreshToken, refreshTokenOptions);
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res: Response) {
  if (!FEATURE_TOKEN_REFRESH) {
    return;
  }
  
  const isProduction = process.env.NODE_ENV === "production";
  
  // Clear access token cookie (must match the options used when setting)
  res.clearCookie("access_token", {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  });
  
  // Clear refresh token cookie (must match the options used when setting)
  res.clearCookie("refresh_token", {
    path: "/api/auth",
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
  });
}

/**
 * Middleware to require authentication via cookies
 * Falls back to Bearer token if cookies are not present (backward compatible)
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Try to get token from cookie first (if feature is enabled)
  let token = FEATURE_TOKEN_REFRESH ? req.cookies?.access_token : undefined;
  let source = "cookie";
  
  // Fall back to Authorization header for backward compatibility
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
      source = "header";
    }
  }
  
  if (!token) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({ error: "No token provided" });
  }
  
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    
    // Add cache control header to prevent caching of authenticated responses
    res.setHeader("Cache-Control", "no-store");
    
    next();
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({ 
      error: "Invalid or expired token",
      source
    });
  }
}

/**
 * Generate new access and refresh tokens
 */
export function generateTokens(payload: { userId: string; email: string }) {
  const accessToken = signToken(payload, "access");
  const refreshToken = signToken(payload, "refresh");
  
  return { accessToken, refreshToken };
}
