import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Admin user IDs (replace with your admin user IDs in production)
// Or add an `isAdmin` boolean column to users table
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(",") || [];

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        code: 401,
        message: "Unauthorized - authentication required",
      });
    }

    // Check if user is admin
    // Option 1: Check ADMIN_USER_IDS environment variable
    if (ADMIN_USER_IDS.length > 0 && ADMIN_USER_IDS.includes(userId)) {
      return next();
    }

    // Option 2: Check database for isAdmin field (if you add it to users table)
    // const user = await db.query.users.findFirst({
    //   where: eq(users.id, userId),
    // });
    // if (user?.isAdmin) {
    //   return next();
    // }

    return res.status(403).json({
      code: 403,
      message: "Forbidden - admin access required",
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
}
