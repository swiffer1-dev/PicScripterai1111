import type { Platform } from "@shared/schema";
import { BaseWebhookHandler } from "./base";
import { FacebookWebhookHandler } from "./facebook";
import { TikTokWebhookHandler } from "./tiktok";
import { TwitterWebhookHandler } from "./twitter";
import { LinkedInWebhookHandler } from "./linkedin";
import { PinterestWebhookHandler } from "./pinterest";
import { YouTubeWebhookHandler } from "./youtube";

export class WebhookHandlerFactory {
  private static handlers: Map<Platform, BaseWebhookHandler> = new Map();

  static getHandler(platform: Platform): BaseWebhookHandler | null {
    if (this.handlers.has(platform)) {
      return this.handlers.get(platform)!;
    }

    try {
      let handler: BaseWebhookHandler;

      switch (platform) {
        case "facebook":
          handler = new FacebookWebhookHandler("facebook");
          break;
        case "instagram":
          handler = new FacebookWebhookHandler("instagram");
          break;
        case "tiktok":
          handler = new TikTokWebhookHandler();
          break;
        case "twitter":
          handler = new TwitterWebhookHandler();
          break;
        case "linkedin":
          handler = new LinkedInWebhookHandler();
          break;
        case "pinterest":
          handler = new PinterestWebhookHandler();
          break;
        case "youtube":
          handler = new YouTubeWebhookHandler();
          break;
        default:
          console.warn(`No webhook handler configured for platform: ${platform}`);
          return null;
      }

      this.handlers.set(platform, handler);
      return handler;
    } catch (error) {
      console.error(`Failed to initialize webhook handler for ${platform}:`, error);
      return null;
    }
  }

  static getSupportedPlatforms(): Platform[] {
    return ["facebook", "instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube"];
  }

  static clearCache(): void {
    this.handlers.clear();
  }
}
