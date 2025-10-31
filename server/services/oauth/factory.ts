import { Platform } from "@shared/schema";
import { OAuthProvider } from "./base";
import { InstagramOAuthProvider } from "./instagram";

const BASE_URL = process.env.CORS_ORIGIN || "http://localhost:5000";

export function getOAuthProvider(platform: Platform): OAuthProvider {
  const redirectUri = `${BASE_URL}/api/callback/${platform}`;
  
  switch (platform) {
    case "instagram":
      return new InstagramOAuthProvider({
        clientId: process.env.INSTAGRAM_CLIENT_ID || "",
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["instagram_basic", "instagram_content_publish"],
        authUrl: "https://api.instagram.com/oauth/authorize",
        tokenUrl: "https://api.instagram.com/oauth/access_token",
      });
      
    case "facebook":
      return new InstagramOAuthProvider({
        clientId: process.env.FACEBOOK_APP_ID || "",
        clientSecret: process.env.FACEBOOK_APP_SECRET || "",
        redirectUri,
        scopes: ["pages_manage_posts", "pages_read_engagement"],
        authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
      });
      
    case "tiktok":
      return new InstagramOAuthProvider({
        clientId: process.env.TIKTOK_CLIENT_KEY || "",
        clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["video.upload", "video.publish"],
        authUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
      });
      
    case "twitter":
      return new InstagramOAuthProvider({
        clientId: process.env.TWITTER_CLIENT_ID || "",
        clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["tweet.read", "tweet.write", "users.read"],
        authUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
      });
      
    case "linkedin":
      return new InstagramOAuthProvider({
        clientId: process.env.LINKEDIN_CLIENT_ID || "",
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["w_member_social"],
        authUrl: "https://www.linkedin.com/oauth/v2/authorization",
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      });
      
    case "pinterest":
      return new InstagramOAuthProvider({
        clientId: process.env.PINTEREST_APP_ID || "",
        clientSecret: process.env.PINTEREST_APP_SECRET || "",
        redirectUri,
        scopes: ["boards:read", "pins:write"],
        authUrl: "https://www.pinterest.com/oauth/",
        tokenUrl: "https://api.pinterest.com/v5/oauth/token",
      });
      
    case "youtube":
      return new InstagramOAuthProvider({
        clientId: process.env.YOUTUBE_CLIENT_ID || "",
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["https://www.googleapis.com/auth/youtube.upload"],
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
      });
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
