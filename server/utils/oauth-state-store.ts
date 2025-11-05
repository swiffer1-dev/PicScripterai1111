import Redis from "ioredis";
import type { OAuthState } from "../services/oauth/base";
import type { EcommerceOAuthState } from "../services/ecommerce-oauth/base";

class OAuthStateStore {
  private redis: Redis | null = null;
  private fallbackStore = new Map<string, string>();
  private isRedisAvailable = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn("Redis unavailable - OAuth state will use in-memory fallback (not production-safe)");
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      this.redis.on("ready", () => {
        this.isRedisAvailable = true;
        console.log("✓ Redis connected - OAuth state persistence enabled");
      });

      this.redis.on("error", (err) => {
        this.isRedisAvailable = false;
        console.warn("Redis error - falling back to in-memory OAuth state:", err.message);
      });

      // Connect immediately
      this.redis.connect().catch(() => {
        console.warn("Failed to connect to Redis - using in-memory OAuth state store");
      });
    } else {
      console.warn("⚠️  REDIS_URL not set - OAuth state using in-memory store (not production-safe for multi-instance deployments)");
    }
  }

  async set(key: string, state: OAuthState | EcommerceOAuthState, ttlSeconds = 600): Promise<void> {
    const value = JSON.stringify(state);
    
    if (this.redis && this.isRedisAvailable) {
      try {
        await this.redis.setex(`oauth:state:${key}`, ttlSeconds, value);
        return;
      } catch (error) {
        console.warn("Redis set failed, using fallback:", error);
      }
    }
    
    // Fallback to in-memory
    this.fallbackStore.set(key, value);
    setTimeout(() => this.fallbackStore.delete(key), ttlSeconds * 1000);
  }

  async get(key: string): Promise<OAuthState | EcommerceOAuthState | null> {
    if (this.redis && this.isRedisAvailable) {
      try {
        const value = await this.redis.get(`oauth:state:${key}`);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn("Redis get failed, using fallback:", error);
      }
    }
    
    // Fallback to in-memory
    const value = this.fallbackStore.get(key);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<void> {
    if (this.redis && this.isRedisAvailable) {
      try {
        await this.redis.del(`oauth:state:${key}`);
        return;
      } catch (error) {
        console.warn("Redis delete failed, using fallback:", error);
      }
    }
    
    // Fallback to in-memory
    this.fallbackStore.delete(key);
  }

  async checkHealth(): Promise<boolean> {
    if (!this.redis) {
      return false; // Redis not configured
    }

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export const oauthStateStore = new OAuthStateStore();
