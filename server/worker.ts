import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { storage } from "./storage";
import { publishToPlatform } from "./services/publishers";
import { ensureValidToken } from "./utils/token-refresh";
import { trackEvent } from "./utils/analytics";
import type { PublishJobData } from "./worker-queue";

// Redis connection
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  // Enable TLS for Upstash Redis
  tls: redisUrl.includes('upstash.io') ? {} : undefined,
});

// Create worker
const worker = new Worker<PublishJobData>(
  "publish-queue",
  async (job: Job<PublishJobData>) => {
    const { postId, userId, platform, caption, mediaUrl, mediaType, options } = job.data;
    
    try {
      await storage.createJobLog({
        postId,
        level: "info",
        message: `Starting publish job for ${platform}`,
        raw: { jobId: job.id, attempt: job.attemptsMade + 1 },
      });
      
      // Update post status to publishing
      await storage.updatePost(postId, {
        status: "publishing",
      });
      
      // Get connection
      const connectionRecord = await storage.getConnection(userId, platform);
      if (!connectionRecord) {
        throw new Error(`No ${platform} connection found`);
      }
      
      // Ensure token is valid (refresh if needed)
      const accessToken = await ensureValidToken(connectionRecord);
      
      // Publish to platform
      const result = await publishToPlatform(
        platform,
        accessToken,
        caption,
        mediaUrl,
        mediaType,
        options
      );
      
      // Update post with success
      await storage.updatePost(postId, {
        status: "published",
        externalId: result.id,
        externalUrl: result.url,
      });
      
      await storage.createJobLog({
        postId,
        level: "info",
        message: `Successfully published to ${platform}`,
        raw: result,
      });
      
      // Track post_published event
      await trackEvent(
        userId,
        "post_published",
        "Post published",
        { platform, postId, externalId: result.id }
      );
      
      return result;
    } catch (error: any) {
      await storage.createJobLog({
        postId,
        level: "error",
        message: error.message,
        raw: { error: error.message, attempt: job.attemptsMade + 1 },
      });
      
      // If this is the last attempt, mark as failed
      if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
        await storage.updatePost(postId, {
          status: "failed",
        });
        
        // Track publish_failed event
        await trackEvent(
          userId,
          "publish_failed",
          "Post publish failed",
          { platform, postId, error: error.message }
        );
      }
      
      throw error; // Re-throw to let BullMQ handle retries
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

// Worker event handlers
worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing worker...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing worker...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log("🚀 Worker started, waiting for jobs...");
