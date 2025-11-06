import { z } from "zod";

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  
  // Encryption - support both old and new format (at least one required)
  ENCRYPTION_KEY: z.string().optional(),
  ENCRYPTION_KEYS_JSON: z.string().optional(),
  ENCRYPTION_KEY_CURRENT: z.string().default("v1"),
  
  // Session secret (optional, not currently used but available)
  SESSION_SECRET: z.string().optional(),
  
  // Optional with defaults
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  CORS_ORIGIN: z.string().default("http://localhost:5000"),
  REDIS_URL: z.string().optional(),
  
  // Auth token TTL
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),
  
  // Social Media OAuth (optional - needed for those platform connections)
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  PINTEREST_APP_ID: z.string().optional(),
  PINTEREST_APP_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  
  // E-commerce OAuth (optional - needed for those platform connections)
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  ETSY_CLIENT_ID: z.string().optional(),
  ETSY_CLIENT_SECRET: z.string().optional(),
  SQUARESPACE_CLIENT_ID: z.string().optional(),
  SQUARESPACE_CLIENT_SECRET: z.string().optional(),
  
  // Object Storage
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string().optional(),
  PUBLIC_OBJECT_SEARCH_PATHS: z.string().optional(),
  PRIVATE_OBJECT_DIR: z.string().optional(),
  
  // Database credentials (auto-provided by Replit)
  PGHOST: z.string().optional(),
  PGPORT: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env;

export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    const parsed = envSchema.parse(process.env);
    
    // Additional validation: ensure at least one encryption key is set
    if (!parsed.ENCRYPTION_KEY && !parsed.ENCRYPTION_KEYS_JSON) {
      throw new Error("Either ENCRYPTION_KEY or ENCRYPTION_KEYS_JSON must be set");
    }
    
    validatedEnv = parsed;
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(e => e.message.includes("required"))
        .map(e => e.path.join("."));
      
      console.error("❌ Environment validation failed:");
      console.error("Missing required variables:", missingVars);
      console.error("\nAll validation errors:");
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      
      process.exit(1);
    }
    console.error("❌ Environment validation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error("Environment not validated. Call validateEnv() first.");
  }
  return validatedEnv;
}
