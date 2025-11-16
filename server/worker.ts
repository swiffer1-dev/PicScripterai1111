import "./config/env";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import axios from "axios";
import { storage } from "./storage";
import { publishToPlatform } from "./services/publishers";
import { ensureValidToken } from "./utils/token-refresh";
import { trackEvent } from "./utils/analytics";
import type { PublishJobData, EngagementJobData } from "./worker-queue";
import { engagementQueue } from "./worker-queue";
import { ObjectStorageService, parseObjectPath, signObjectURL } from "./objectStorage";

// Check if worker should be disabled (e.g., during Redis quota exhaustion)
if (process.env.DISABLE_WORKER === '1') {
  console.log('[WORKER] Worker disabled via DISABLE_WORKER=1. Scheduled posts and engagement metrics will not process.');
  process.exit(0);
}

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
      
      // Build platform-specific options with account ID
      const platformOptions = {
        ...options,
        igUserId: platform === 'instagram' ? connectionRecord.accountId : undefined,
        pageId: platform === 'facebook' ? connectionRecord.accountId : undefined,
      };
      
      // Convert object storage paths to signed URLs
      let resolvedMediaUrl = mediaUrl;
      if (mediaUrl) {
        console.log(`[WORKER] Processing media URL for ${platform}`);
        console.log(`[WORKER] Original media URL (first 100 chars):`, mediaUrl.substring(0, 100));
        
        // Normalize storage.googleapis.com URLs to /objects/ paths first
        const objectStorageService = new ObjectStorageService();
        const normalizedPath = objectStorageService.normalizeObjectEntityPath(mediaUrl);
        
        console.log(`[WORKER] Normalized path:`, normalizedPath);
        
        if (normalizedPath.startsWith("/objects/")) {
          try {
            console.log(`[WORKER] Getting object entity file...`);
            const file = await objectStorageService.getObjectEntityFile(normalizedPath);
            
            // Get bucket and object names from the file
            const metadata = await file.getMetadata();
            const bucketName = file.bucket.name;
            const objectName = file.name;
            
            console.log(`[WORKER] Bucket:`, bucketName, `Object:`, objectName);
            
            // Generate signed URL using Replit sidecar (valid for 15 minutes)
            console.log(`[WORKER] Generating signed URL...`);
            const signedUrl = await signObjectURL({
              bucketName,
              objectName,
              method: "GET",
              ttlSec: 900, // 15 minutes
            });
            
            resolvedMediaUrl = signedUrl;
            console.log(`[WORKER] ✓ Generated signed URL (first 100 chars):`, signedUrl.substring(0, 100));
          } catch (error: any) {
            console.error(`[WORKER] ✗ Failed to generate signed URL:`, error.message);
            console.error(`[WORKER] Error stack:`, error.stack);
            throw new Error(`Failed to access media file: ${error.message}`);
          }
        } else {
          console.log(`[WORKER] Path does not start with /objects/, using as-is`);
        }
      } else {
        console.log(`[WORKER] No media URL provided for ${platform} post`);
      }
      
      // Publish to platform
      const result = await publishToPlatform(
        platform,
        accessToken,
        caption,
        resolvedMediaUrl,
        mediaType,
        platformOptions
      );
      
      // Update post with success
      await storage.updatePost(postId, {
        status: "published",
        externalId: result.id,
        externalUrl: result.url,
        publishedAt: new Date(),
      });
      
      await storage.createJobLog({
        postId,
        level: "info",
        message: `Successfully published to ${platform}`,
        raw: result,
      });
      
      // Schedule engagement metrics collection (if enabled for Twitter)
      if (process.env.METRICS_ENGAGEMENT === '1' && platform === 'twitter' && result.id && engagementQueue) {
        try {
          // Schedule T+15 minutes
          await engagementQueue.add(
            'fetch-engagement',
            {
              postId,
              userId,
              platform,
              externalId: result.id,
              run: '15m',
            },
            {
              delay: 15 * 60 * 1000, // 15 minutes in milliseconds
              jobId: `engagement:${postId}:15m`,
            }
          );
          
          // Schedule T+24 hours
          await engagementQueue.add(
            'fetch-engagement',
            {
              postId,
              userId,
              platform,
              externalId: result.id,
              run: '24h',
            },
            {
              delay: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
              jobId: `engagement:${postId}:24h`,
            }
          );
          
          await storage.createJobLog({
            postId,
            level: "info",
            message: "Scheduled engagement metrics collection (15m, 24h)",
            raw: { platform, externalId: result.id },
          });
        } catch (error: any) {
          // Log error but don't fail the publish
          console.warn(`Failed to schedule engagement jobs for ${postId}:`, error.message);
        }
      }
      
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

// Engagement metrics worker (if feature enabled)
let engagementWorker: Worker<EngagementJobData> | null = null;

if (process.env.METRICS_ENGAGEMENT === '1' && connection) {
  engagementWorker = new Worker<EngagementJobData>(
    "engagement",
    async (job: Job<EngagementJobData>) => {
      const { postId, userId, platform, externalId, run } = job.data;
      
      try {
        console.log(`[Engagement] Fetching metrics for ${platform} post ${externalId} (${run})`);
        
        // Get connection for the user
        const connectionRecord = await storage.getConnection(userId, platform);
        if (!connectionRecord) {
          console.warn(`[Engagement] No ${platform} connection found for user ${userId}`);
          return { skipped: true, reason: 'No connection found' };
        }
        
        // Get access token (try to refresh if expired)
        let accessToken: string;
        try {
          accessToken = await ensureValidToken(connectionRecord);
        } catch (error: any) {
          console.warn(`[Engagement] Token refresh failed for ${platform} user ${userId}:`, error.message);
          return { skipped: true, reason: 'Token expired/invalid' };
        }
        
        // Fetch Twitter metrics
        if (platform === 'twitter') {
          const response = await axios.get(
            `https://api.twitter.com/2/tweets/${externalId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              params: {
                'tweet.fields': 'public_metrics',
              },
            }
          );
          
          const metrics = response.data.data?.public_metrics;
          if (!metrics) {
            console.warn(`[Engagement] No metrics returned for tweet ${externalId}`);
            return { skipped: true, reason: 'No metrics available' };
          }
          
          // Save metrics to database
          await storage.createPostMetrics({
            userId,
            postId,
            platform,
            externalId,
            likes: metrics.like_count || 0,
            reposts: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
            quotes: metrics.quote_count || 0,
            impressions: metrics.impression_count || 0,
          });
          
          console.log(`[Engagement] Saved metrics for tweet ${externalId}: ${metrics.like_count} likes, ${metrics.retweet_count} retweets`);
          
          return {
            success: true,
            metrics,
            run,
          };
        }
        
        return { skipped: true, reason: 'Platform not supported yet' };
      } catch (error: any) {
        // Log error but don't retry aggressively
        console.error(`[Engagement] Error fetching metrics for ${postId}:`, error.message);
        
        // If rate limited or auth error, don't retry
        if (error.response?.status === 429 || error.response?.status === 401) {
          console.warn(`[Engagement] Skipping retries for ${postId} due to ${error.response.status}`);
          return { skipped: true, reason: `HTTP ${error.response.status}` };
        }
        
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Lower concurrency for API rate limits
    }
  );
  
  engagementWorker.on("completed", (job) => {
    console.log(`[Engagement] Job ${job.id} completed`);
  });
  
  engagementWorker.on("failed", (job, error) => {
    console.error(`[Engagement] Job ${job?.id} failed:`, error.message);
  });
  
  console.log("✅ Engagement metrics worker started");
}

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
  console.log("SIGTERM received, closing workers...");
  await worker.close();
  if (engagementWorker) await engagementWorker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing workers...");
  await worker.close();
  if (engagementWorker) await engagementWorker.close();
  await connection.quit();
  process.exit(0);
});

console.log("🚀 Worker started, waiting for jobs...");
