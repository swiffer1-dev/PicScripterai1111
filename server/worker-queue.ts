import { Queue } from "bullmq";
import Redis from "ioredis";
import type { Platform } from "@shared/schema";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// Suppress connection errors in development
connection.on("error", (err) => {
  if (process.env.NODE_ENV === "development") {
    console.warn("Redis connection warning (queue disabled in dev without Redis):", err.message);
  } else {
    console.error("Redis connection error:", err);
  }
});

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
export const publishQueue = new Queue<PublishJobData>("publish-queue", {
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
});
