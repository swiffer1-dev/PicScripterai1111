import crypto from "crypto";
import type { Request } from "express";
import type { Platform, WebhookEventType, InsertWebhookEvent } from "@shared/schema";

export interface RequestWithRawBody extends Request {
  rawBody?: string | Buffer;
}

export interface WebhookPayload {
  platform: Platform;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  signature?: string;
  userId?: string;
  postId?: string;
}

export interface VerificationResult {
  verified: boolean;
  error?: string;
}

export abstract class BaseWebhookHandler {
  protected platform: Platform;
  
  constructor(platform: Platform) {
    this.platform = platform;
  }

  abstract verifySignature(req: RequestWithRawBody): Promise<VerificationResult>;
  
  abstract parsePayload(req: RequestWithRawBody): Promise<WebhookPayload>;
  
  abstract shouldProcess(payload: WebhookPayload): boolean;
  
  protected getRawBody(req: RequestWithRawBody): string {
    if (req.rawBody) {
      if (Buffer.isBuffer(req.rawBody)) {
        return req.rawBody.toString('utf8');
      }
      return req.rawBody;
    }
    return JSON.stringify(req.body);
  }
  
  async handle(req: RequestWithRawBody): Promise<InsertWebhookEvent | null> {
    const verification = await this.verifySignature(req);
    if (!verification.verified) {
      console.error(`[${this.platform}] Webhook verification failed:`, verification.error);
      return null;
    }

    const webhookPayload = await this.parsePayload(req);
    
    if (!this.shouldProcess(webhookPayload)) {
      console.log(`[${this.platform}] Skipping webhook event:`, webhookPayload.eventType);
      return null;
    }

    return {
      platform: webhookPayload.platform,
      eventType: webhookPayload.eventType,
      payload: webhookPayload.payload,
      signature: webhookPayload.signature,
      status: "pending" as const,
      userId: webhookPayload.userId,
      postId: webhookPayload.postId,
      errorMessage: null,
    };
  }
}

export class SignatureVerifier {
  static verifyHMAC(
    secret: string,
    payload: string,
    signature: string,
    algorithm: string = "sha256",
    encoding: "hex" | "base64" = "hex"
  ): boolean {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest(encoding);
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, encoding),
        Buffer.from(expectedSignature, encoding)
      );
    } catch (error) {
      return false;
    }
  }

  static verifyHMACSHA256Hex(secret: string, payload: string, signature: string): boolean {
    return this.verifyHMAC(secret, payload, signature, "sha256", "hex");
  }

  static verifyHMACSHA256Base64(secret: string, payload: string, signature: string): boolean {
    return this.verifyHMAC(secret, payload, signature, "sha256", "base64");
  }

  static verifyHMACSHA1(secret: string, payload: string, signature: string): boolean {
    return this.verifyHMAC(secret, payload, signature, "sha1", "hex");
  }

  static extractSignatureFromHeader(
    headerValue: string,
    prefix: string = "sha256="
  ): string {
    if (headerValue.startsWith(prefix)) {
      return headerValue.slice(prefix.length);
    }
    return headerValue;
  }

  static validateIPAllowlist(clientIP: string, allowlist: string[]): boolean {
    return allowlist.includes(clientIP);
  }
}
