import type { Platform, EcommercePlatform } from "@shared/schema";

interface PlatformConfig {
  platform: Platform | EcommercePlatform;
  clientIdKey: string;
  clientSecretKey: string;
}

const socialPlatformConfigs: PlatformConfig[] = [
  { platform: "instagram", clientIdKey: "INSTAGRAM_CLIENT_ID", clientSecretKey: "INSTAGRAM_CLIENT_SECRET" },
  { platform: "tiktok", clientIdKey: "TIKTOK_CLIENT_KEY", clientSecretKey: "TIKTOK_CLIENT_SECRET" },
  { platform: "twitter", clientIdKey: "TWITTER_CLIENT_ID", clientSecretKey: "TWITTER_CLIENT_SECRET" },
  { platform: "linkedin", clientIdKey: "LINKEDIN_CLIENT_ID", clientSecretKey: "LINKEDIN_CLIENT_SECRET" },
  { platform: "pinterest", clientIdKey: "PINTEREST_APP_ID", clientSecretKey: "PINTEREST_APP_SECRET" },
  { platform: "youtube", clientIdKey: "YOUTUBE_CLIENT_ID", clientSecretKey: "YOUTUBE_CLIENT_SECRET" },
  { platform: "facebook", clientIdKey: "FACEBOOK_APP_ID", clientSecretKey: "FACEBOOK_APP_SECRET" },
];

const ecommercePlatformConfigs: PlatformConfig[] = [
  { platform: "shopify", clientIdKey: "SHOPIFY_CLIENT_ID", clientSecretKey: "SHOPIFY_CLIENT_SECRET" },
  { platform: "etsy", clientIdKey: "ETSY_CLIENT_ID", clientSecretKey: "ETSY_CLIENT_SECRET" },
  { platform: "squarespace", clientIdKey: "SQUARESPACE_CLIENT_ID", clientSecretKey: "SQUARESPACE_CLIENT_SECRET" },
];

export function validatePlatformConfigurations(): void {
  console.log("\n🔐 Platform Configuration Status:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Check social platforms
  console.log("\nSocial Media Platforms:");
  const configuredSocial: string[] = [];
  const missingSocial: string[] = [];
  
  for (const config of socialPlatformConfigs) {
    const hasClientId = !!process.env[config.clientIdKey];
    const hasClientSecret = !!process.env[config.clientSecretKey];
    const isConfigured = hasClientId && hasClientSecret;
    
    if (isConfigured) {
      configuredSocial.push(config.platform);
      console.log(`  ✓ ${config.platform.padEnd(12)} - Configured`);
    } else {
      missingSocial.push(config.platform);
      console.log(`  ○ ${config.platform.padEnd(12)} - Not configured (users cannot connect)`);
    }
  }
  
  // Check e-commerce platforms
  console.log("\nE-commerce Platforms:");
  const configuredEcommerce: string[] = [];
  const missingEcommerce: string[] = [];
  
  for (const config of ecommercePlatformConfigs) {
    const hasClientId = !!process.env[config.clientIdKey];
    const hasClientSecret = !!process.env[config.clientSecretKey];
    const isConfigured = hasClientId && hasClientSecret;
    
    if (isConfigured) {
      configuredEcommerce.push(config.platform);
      console.log(`  ✓ ${config.platform.padEnd(12)} - Configured`);
    } else {
      missingEcommerce.push(config.platform);
      console.log(`  ○ ${config.platform.padEnd(12)} - Not configured (users cannot connect)`);
    }
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total configured: ${configuredSocial.length + configuredEcommerce.length} / ${socialPlatformConfigs.length + ecommercePlatformConfigs.length}`);
  
  if (configuredSocial.length === 0 && configuredEcommerce.length === 0) {
    console.warn("\n⚠️  WARNING: No platforms configured! Users will not be able to connect any accounts.");
    console.warn("    Add OAuth credentials to environment variables to enable platform connections.\n");
  }
}

export function isPlatformConfigured(platform: Platform | EcommercePlatform): boolean {
  const config = [...socialPlatformConfigs, ...ecommercePlatformConfigs]
    .find(c => c.platform === platform);
  
  if (!config) return false;
  
  return !!process.env[config.clientIdKey] && !!process.env[config.clientSecretKey];
}

export function getConfigurationError(platform: Platform | EcommercePlatform): string {
  const config = [...socialPlatformConfigs, ...ecommercePlatformConfigs]
    .find(c => c.platform === platform);
  
  if (!config) {
    return `Unknown platform: ${platform}`;
  }
  
  const missingKeys: string[] = [];
  if (!process.env[config.clientIdKey]) missingKeys.push(config.clientIdKey);
  if (!process.env[config.clientSecretKey]) missingKeys.push(config.clientSecretKey);
  
  if (missingKeys.length > 0) {
    return `${platform} is not configured. Missing environment variables: ${missingKeys.join(", ")}`;
  }
  
  return "";
}
