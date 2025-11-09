import { BaseWebhookHandler, SignatureVerifier, type RequestWithRawBody, type WebhookPayload, type VerificationResult } from "./base";
import type { WebhookEventType } from "@shared/schema";

export class TikTokWebhookHandler extends BaseWebhookHandler {
  private clientSecret: string;

  constructor() {
    super("tiktok");
    const secret = process.env.TIKTOK_CLIENT_SECRET;
    
    if (!secret) {
      throw new Error("TIKTOK_CLIENT_SECRET not configured");
    }
    this.clientSecret = secret;
  }

  async verifySignature(req: RequestWithRawBody): Promise<VerificationResult> {
    const signature = req.headers["x-tiktok-signature"] as string;
    
    if (!signature) {
      return { verified: false, error: "Missing X-TikTok-Signature header" };
    }

    const rawBody = this.getRawBody(req);
    const verified = SignatureVerifier.verifyHMACSHA256Hex(this.clientSecret, rawBody, signature);
    
    return verified 
      ? { verified: true } 
      : { verified: false, error: "Invalid signature" };
  }

  async parsePayload(req: RequestWithRawBody): Promise<WebhookPayload> {
    const body = req.body;
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    const event = body.event;
    
    if (event === "video.publish.complete") {
      eventType = "post.published";
      postId = body.video_id;
    } else if (event === "video.publish.failed") {
      eventType = "post.failed";
      postId = body.video_id;
    } else if (event === "user.authorization.revoke") {
      eventType = "token.revoked";
    }

    return {
      platform: this.platform,
      eventType,
      payload: body,
      signature: req.headers["x-tiktok-signature"] as string,
      postId,
    };
  }

  shouldProcess(payload: WebhookPayload): boolean {
    return payload.eventType !== "other";
  }
}
