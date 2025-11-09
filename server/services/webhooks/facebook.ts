import type { Request } from "express";
import { BaseWebhookHandler, SignatureVerifier, type WebhookPayload, type VerificationResult } from "./base";
import type { Platform, WebhookEventType } from "@shared/schema";

export class FacebookWebhookHandler extends BaseWebhookHandler {
  private appSecret: string;

  constructor(platform: "facebook" | "instagram") {
    super(platform);
    const secret = platform === "facebook" 
      ? process.env.FACEBOOK_APP_SECRET 
      : process.env.INSTAGRAM_APP_SECRET;
    
    if (!secret) {
      throw new Error(`${platform.toUpperCase()}_APP_SECRET not configured`);
    }
    this.appSecret = secret;
  }

  async verifySignature(req: Request): Promise<VerificationResult> {
    const signature = req.headers["x-hub-signature-256"] as string;
    
    if (!signature) {
      return { verified: false, error: "Missing X-Hub-Signature-256 header" };
    }

    const rawBody = JSON.stringify(req.body);
    const sig = SignatureVerifier.extractSignatureFromHeader(signature, "sha256=");
    
    const verified = SignatureVerifier.verifyHMACSHA256(this.appSecret, rawBody, sig);
    
    return verified 
      ? { verified: true } 
      : { verified: false, error: "Invalid signature" };
  }

  async parsePayload(req: Request): Promise<WebhookPayload> {
    const body = req.body;
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    if (changes?.field === "feed" && changes?.value?.verb === "add") {
      eventType = "post.published";
      postId = changes.value.post_id;
    } else if (changes?.field === "feed" && changes?.value?.verb === "remove") {
      eventType = "post.failed";
      postId = changes.value.post_id;
    } else if (body.object === "permissions" || changes?.field === "permissions") {
      eventType = "account.deauthorized";
    }

    return {
      platform: this.platform,
      eventType,
      payload: body,
      signature: req.headers["x-hub-signature-256"] as string,
      postId,
    };
  }

  shouldProcess(payload: WebhookPayload): boolean {
    return payload.eventType !== "other";
  }

  static handleVerification(req: Request): string | null {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 
                        process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      return challenge as string;
    }

    return null;
  }
}
