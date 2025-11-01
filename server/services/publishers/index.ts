import { Platform } from "@shared/schema";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToTikTok } from "./tiktok";
import { publishToTwitter } from "./twitter";
import { publishToLinkedIn } from "./linkedin";
import { publishToPinterest } from "./pinterest";
import { publishToYouTube } from "./youtube";

export interface PublishResult {
  id: string;
  url: string;
}

export async function publishToPlatform(
  platform: Platform,
  accessToken: string,
  caption: string,
  mediaUrl?: string,
  mediaType?: string,
  options?: any
): Promise<PublishResult> {
  switch (platform) {
    case "facebook":
      return await publishToFacebook(accessToken, caption, mediaUrl, options);
      
    case "instagram":
      return await publishToInstagram(accessToken, caption, mediaUrl, mediaType, options);
      
    case "tiktok":
      return await publishToTikTok(accessToken, caption, mediaUrl, options);
      
    case "twitter":
      return await publishToTwitter(accessToken, caption, mediaUrl, options);
      
    case "linkedin":
      return await publishToLinkedIn(accessToken, caption, mediaUrl, options);
      
    case "pinterest":
      return await publishToPinterest(accessToken, caption, mediaUrl, options);
      
    case "youtube":
      return await publishToYouTube(accessToken, caption, mediaUrl, options);
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
