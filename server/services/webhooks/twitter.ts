import type { Request } from "express";
import crypto from "crypto";
import { BaseWebhookHandler, type WebhookPayload, type VerificationResult } from "./base";
import type { WebhookEventType } from "@shared/schema";

export class TwitterWebhookHandler extends BaseWebhookHandler {
  private consumerSecret: string;

  constructor() {
    super("twitter");
    const secret = process.env.TWITTER_CONSUMER_SECRET;
    
    if (!secret) {
      throw new Error("TWITTER_CONSUMER_SECRET not configured");
    }
    this.consumerSecret = secret;
  }

  async verifySignature(req: Request): Promise<VerificationResult> {
    const signature = req.headers["x-twitter-webhooks-signature"] as string;
    
    if (!signature) {
      return { verified: false, error: "Missing X-Twitter-Webhooks-Signature header" };
    }

    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", this.consumerSecret)
      .update(rawBody)
      .digest("base64");
    
    const sig = signature.replace("sha256=", "");
    
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature))
      ? { verified: true }
      : { verified: false, error: "Invalid signature" };
  }

  async parsePayload(req: Request): Promise<WebhookPayload> {
    const body = req.body;
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    if (body.tweet_create_events) {
      eventType = "post.published";
      postId = body.tweet_create_events[0]?.id_str;
    } else if (body.tweet_delete_events) {
      eventType = "post.failed";
      postId = body.tweet_delete_events[0]?.status?.id_str;
    } else if (body.user_event?.revoke) {
      eventType = "token.revoked";
    }

    return {
      platform: this.platform,
      eventType,
      payload: body,
      signature: req.headers["x-twitter-webhooks-signature"] as string,
      postId,
    };
  }

  shouldProcess(payload: WebhookPayload): boolean {
    return payload.eventType !== "other";
  }

  static handleCRCChallenge(req: Request): string | null {
    const crcToken = req.query.crc_token as string;
    
    if (!crcToken) {
      return null;
    }

    const secret = process.env.TWITTER_CONSUMER_SECRET;
    if (!secret) {
      return null;
    }

    const responseToken = crypto
      .createHmac("sha256", secret)
      .update(crcToken)
      .digest("base64");

    return `sha256=${responseToken}`;
  }
}
