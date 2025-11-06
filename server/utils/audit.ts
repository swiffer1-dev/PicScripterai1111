import type { Request } from "express";
import { db } from "../db";
import { auditEvents } from "../../shared/schema";
import type { auditActionEnum } from "../../shared/schema";

type AuditAction = typeof auditActionEnum.enumValues[number];

interface AuditLogOptions {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  req?: Request;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(options: AuditLogOptions): Promise<void> {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    req,
    ipAddress,
    userAgent,
  } = options;

  try {
    const ip = ipAddress || req?.ip || req?.socket?.remoteAddress || null;
    const ua = userAgent || req?.get("user-agent") || null;

    await db.insert(auditEvents).values({
      userId: userId || null,
      action,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      metadata: metadata || null,
      ipAddress: ip,
      userAgent: ua,
    });
  } catch (error) {
    // Don't throw on audit log failure - log but continue
    console.error("Failed to write audit log:", error);
  }
}

// Convenience functions for common audit actions
export const audit = {
  async userLogin(userId: string, req: Request) {
    await logAudit({
      userId,
      action: "user.login",
      req,
    });
  },

  async userLogout(userId: string, req: Request) {
    await logAudit({
      userId,
      action: "user.logout",
      req,
    });
  },

  async userRegister(userId: string, req: Request, email: string) {
    await logAudit({
      userId,
      action: "user.register",
      metadata: { email },
      req,
    });
  },

  async connectionCreate(userId: string, platform: string, connectionId: string, req: Request) {
    await logAudit({
      userId,
      action: "connection.create",
      resourceType: "connection",
      resourceId: connectionId,
      metadata: { platform },
      req,
    });
  },

  async connectionDelete(userId: string, platform: string, connectionId: string, req: Request) {
    await logAudit({
      userId,
      action: "connection.delete",
      resourceType: "connection",
      resourceId: connectionId,
      metadata: { platform },
      req,
    });
  },

  async ecommerceConnectionCreate(userId: string, platform: string, connectionId: string, req: Request) {
    await logAudit({
      userId,
      action: "ecommerce_connection.create",
      resourceType: "ecommerce_connection",
      resourceId: connectionId,
      metadata: { platform },
      req,
    });
  },

  async ecommerceConnectionDelete(userId: string, platform: string, connectionId: string, req: Request) {
    await logAudit({
      userId,
      action: "ecommerce_connection.delete",
      resourceType: "ecommerce_connection",
      resourceId: connectionId,
      metadata: { platform },
      req,
    });
  },

  async postCreate(userId: string, postId: string, platform: string, req: Request) {
    await logAudit({
      userId,
      action: "post.create",
      resourceType: "post",
      resourceId: postId,
      metadata: { platform },
      req,
    });
  },

  async postUpdate(userId: string, postId: string, platform: string, req: Request) {
    await logAudit({
      userId,
      action: "post.update",
      resourceType: "post",
      resourceId: postId,
      metadata: { platform },
      req,
    });
  },

  async postDelete(userId: string, postId: string, platform: string, req: Request) {
    await logAudit({
      userId,
      action: "post.delete",
      resourceType: "post",
      resourceId: postId,
      metadata: { platform },
      req,
    });
  },

  async postSchedule(userId: string, postId: string, platform: string, scheduledAt: Date, req: Request) {
    await logAudit({
      userId,
      action: "post.schedule",
      resourceType: "post",
      resourceId: postId,
      metadata: { platform, scheduledAt: scheduledAt.toISOString() },
      req,
    });
  },

  async postPublish(userId: string, postId: string, platform: string, externalId?: string) {
    await logAudit({
      userId,
      action: "post.publish",
      resourceType: "post",
      resourceId: postId,
      metadata: { platform, externalId },
    });
  },

  async draftCreate(userId: string, draftId: string, req: Request) {
    await logAudit({
      userId,
      action: "draft.create",
      resourceType: "draft",
      resourceId: draftId,
      req,
    });
  },

  async draftUpdate(userId: string, draftId: string, req: Request) {
    await logAudit({
      userId,
      action: "draft.update",
      resourceType: "draft",
      resourceId: draftId,
      req,
    });
  },

  async draftDelete(userId: string, draftId: string, req: Request) {
    await logAudit({
      userId,
      action: "draft.delete",
      resourceType: "draft",
      resourceId: draftId,
      req,
    });
  },
};
