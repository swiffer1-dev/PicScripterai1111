import type { Request } from "express";
import { BaseWebhookHandler, SignatureVerifier, type WebhookPayload, type VerificationResult } from "./base";
import type { WebhookEventType } from "@shared/schema";

export class PinterestWebhookHandler extends BaseWebhookHandler {
  private appSecret: string;

  constructor() {
    super("pinterest");
    const secret = process.env.PINTEREST_APP_SECRET;
    
    if (!secret) {
      throw new Error("PINTEREST_APP_SECRET not configured");
    }
    this.appSecret = secret;
  }

  async verifySignature(req: Request): Promise<VerificationResult> {
    const signature = req.headers["x-pinterest-signature"] as string;
    
    if (!signature) {
      return { verified: false, error: "Missing X-Pinterest-Signature header" };
    }

    const rawBody = JSON.stringify(req.body);
    const verified = SignatureVerifier.verifyHMACSHA256(this.appSecret, rawBody, signature);
    
    return verified 
      ? { verified: true } 
      : { verified: false, error: "Invalid signature" };
  }

  async parsePayload(req: Request): Promise<WebhookPayload> {
    const body = req.body;
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    const event = body.event_type;
    
    if (event === "pin_created") {
      eventType = "post.published";
      postId = body.data?.id;
    } else if (event === "pin_deleted") {
      eventType = "post.failed";
      postId = body.data?.id;
    } else if (event === "user_account_deauthorized") {
      eventType = "account.deauthorized";
    }

    return {
      platform: this.platform,
      eventType,
      payload: body,
      signature: req.headers["x-pinterest-signature"] as string,
      postId,
    };
  }

  shouldProcess(payload: WebhookPayload): boolean {
    return payload.eventType !== "other";
  }
}
