import { Queue } from "bullmq";
import Redis from "ioredis";
import type { Platform } from "@shared/schema";

let redisAvailable = false;
let connection: Redis | null = null;

// Redis connection
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.warn("⚠️  Redis unavailable - scheduled posts will not work");
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    enableReadyCheck: true,
  });

  connection.on("ready", () => {
    redisAvailable = true;
    console.log("✓ Redis connected - job queue enabled");
  });

  connection.on("error", (err) => {
    redisAvailable = false;
    console.warn("⚠️  Redis error - job queue unavailable:", err.message);
  });

  // Try to connect
  connection.connect().catch(() => {
    console.warn("⚠️  Failed to connect to Redis - scheduled posts disabled");
  });
} else {
  console.warn("⚠️  REDIS_URL not set - scheduled posts disabled (posts will publish immediately)");
}

// Job data interface
export interface PublishJobData {
  postId: string;
  userId: string;
  platform: Platform;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  options?: any;
}

// Create queue with error handling
export const publishQueue = connection ? new Queue<PublishJobData>("publish-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
}) : null;

export function isQueueAvailable(): boolean {
  return redisAvailable && !!connection && !!publishQueue;
}

export function getQueueStatus(): { available: boolean; reason?: string } {
  if (!redisUrl) {
    return { available: false, reason: "REDIS_URL not configured" };
  }
  if (!connection) {
    return { available: false, reason: "Redis connection not initialized" };
  }
  if (!redisAvailable) {
    return { available: false, reason: "Redis connection failed" };
  }
  if (!publishQueue) {
    return { available: false, reason: "Job queue not initialized" };
  }
  return { available: true };
}
