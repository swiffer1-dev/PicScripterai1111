import type { Request } from "express";
import { BaseWebhookHandler, type WebhookPayload, type VerificationResult } from "./base";
import type { WebhookEventType } from "@shared/schema";

export class YouTubeWebhookHandler extends BaseWebhookHandler {
  constructor() {
    super("youtube");
  }

  async verifySignature(req: Request): Promise<VerificationResult> {
    return { verified: true };
  }

  async parsePayload(req: Request): Promise<WebhookPayload> {
    const body = req.body;
    let eventType: WebhookEventType = "other";
    let postId: string | undefined;

    const event = body.feed?.entry;
    
    if (event && event["yt:videoid"]) {
      const videoId = event["yt:videoid"];
      
      if (event.published) {
        eventType = "post.published";
        postId = videoId;
      } else if (event.deleted) {
        eventType = "post.failed";
        postId = videoId;
      }
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

  static handleSubscriptionVerification(req: Request): string | null {
    const challenge = req.query["hub.challenge"] as string;
    const mode = req.query["hub.mode"] as string;

    if (mode === "subscribe" && challenge) {
      return challenge;
    }

    return null;
  }
}
