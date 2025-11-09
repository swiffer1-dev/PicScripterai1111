import crypto from "crypto";
import { BaseWebhookHandler, SignatureVerifier, type RequestWithRawBody, type WebhookPayload, type VerificationResult } from "./base";
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

  async verifySignature(req: RequestWithRawBody): Promise<VerificationResult> {
    const signature = req.headers["x-twitter-webhooks-signature"] as string;
    
    if (!signature) {
      return { verified: false, error: "Missing X-Twitter-Webhooks-Signature header" };
    }

    const rawBody = this.getRawBody(req);
    const sig = SignatureVerifier.extractSignatureFromHeader(signature, "sha256=");
    
    const verified = SignatureVerifier.verifyHMACSHA256Base64(this.consumerSecret, rawBody, sig);
    
    return verified
      ? { verified: true }
      : { verified: false, error: "Invalid signature" };
  }

  async parsePayload(req: RequestWithRawBody): Promise<WebhookPayload> {
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

  static handleCRCChallenge(req: RequestWithRawBody): string | null {
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
