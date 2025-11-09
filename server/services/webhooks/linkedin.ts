import type { Request } from "express";
import { BaseWebhookHandler, type WebhookPayload, type VerificationResult } from "./base";
import type { WebhookEventType } from "@shared/schema";

export class LinkedInWebhookHandler extends BaseWebhookHandler {
  constructor() {
    super("linkedin");
  }

  async verifySignature(req: Request): Promise<VerificationResult> {
    return { verified: true };
  }

  async parsePayload(req: Request): Promise<WebhookPayload> {
    const body = req.body;
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    const event = body.eventType;
    
    if (event === "SHARE_CREATED") {
      eventType = "post.published";
      postId = body.activity;
    } else if (event === "SHARE_DELETED") {
      eventType = "post.failed";
      postId = body.activity;
    } else if (event === "MEMBER_PERMISSION_REVOKED") {
      eventType = "token.revoked";
    }

    return {
      platform: this.platform,
      eventType,
      payload: body,
      postId,
    };
  }

  shouldProcess(payload: WebhookPayload): boolean {
    return payload.eventType !== "other";
  }
}
