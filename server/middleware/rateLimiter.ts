import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Rate limit for general API endpoints (per IP)
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for authentication endpoints (per IP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs (allows for retries/shared IPs)
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limit for AI generation endpoints (per user)
export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 AI generations per hour
  message: "AI generation limit reached, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated
    const userId = (req as any).userId;
    if (userId) {
      return `user:${userId}`;
    }
    // Default to IP-based limiting (handled by express-rate-limit)
    return undefined as any;
  },
});

// Rate limit for post creation (per user)
export const postCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each user to 30 posts per hour
  message: "Post creation limit reached, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated
    const userId = (req as any).userId;
    if (userId) {
      return `user:${userId}`;
    }
    // Default to IP-based limiting (handled by express-rate-limit)
    return undefined as any;
  },
});

// Rate limit for OAuth connections (per IP)
export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OAuth attempts per windowMs
  message: "Too many connection attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
