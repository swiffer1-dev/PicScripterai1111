import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { type AuthRequest } from "./middleware/auth";
import { 
  requireAuth, 
  setAuthCookies, 
  clearAuthCookies, 
  generateTokens 
} from "./middleware/cookie-auth";
import { 
  authRateLimiter, 
  generalRateLimiter, 
  aiGenerationRateLimiter,
  postCreationRateLimiter,
  oauthRateLimiter
} from "./middleware/rateLimiter";
import { signToken, verifyToken } from "./utils/jwt";
import { encryptToken, decryptToken } from "./utils/encryption";
import { getSafeRedirectUri } from "./utils/redirect-validator";
import { getOAuthProvider } from "./services/oauth/factory";
import { generatePKCE, type OAuthState } from "./services/oauth/base";
import { getEcommerceOAuthProvider } from "./services/ecommerce-oauth/factory";
import { type EcommerceOAuthState } from "./services/ecommerce-oauth/base";
import { publishToPlatform } from "./services/publishers";
import { publishQueue, isQueueAvailable, getQueueStatus } from "./worker-queue";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { trackEvent } from "./utils/analytics";
import { oauthStateStore } from "./utils/oauth-state-store";
import { isPlatformConfigured, getConfigurationError } from "./utils/platform-config-validator";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertPostSchema, type Platform, type EcommercePlatform } from "@shared/schema";
import { WebhookHandlerFactory } from "./services/webhooks/factory";
import { FacebookWebhookHandler } from "./services/webhooks/facebook";
import { TwitterWebhookHandler } from "./services/webhooks/twitter";
import { YouTubeWebhookHandler } from "./services/webhooks/youtube";
import type { RequestWithRawBody } from "./services/webhooks/base";
import { generateDescription, proofreadText, type ImagePart } from "./services/gemini";

// Metrics tracking
const metrics = {
  requests: {
    total: 0,
    byEndpoint: new Map<string, number>(),
    byStatus: new Map<number, number>(),
  },
  auth: {
    signups: 0,
    logins: 0,
    failures: 0,
  },
  posts: {
    created: 0,
    published: 0,
    failed: 0,
  },
  ai: {
    generations: 0,
    errors: 0,
  },
  connections: {
    total: 0,
    byPlatform: new Map<string, number>(),
  },
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints
  app.get("/healthz", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/readyz", async (req, res) => {
    try {
      // Check database connection - let errors propagate so we can detect real failures
      await storage.getUserByEmail("healthcheck@test.local");
      
      // Check Redis if configured
      const redisHealthy = await oauthStateStore.checkHealth();
      const redisConfigured = !!process.env.REDIS_URL;
      
      if (redisConfigured && !redisHealthy) {
        return res.status(503).json({ 
          status: "degraded", 
          database: "ok",
          redis: "unavailable",
          warning: "OAuth and scheduled posts may not work correctly"
        });
      }
      
      res.json({ 
        status: "ready",
        database: "ok",
        redis: redisConfigured ? "ok" : "not_configured"
      });
    } catch (error: any) {
      res.status(503).json({ 
        status: "not ready", 
        database: "unavailable",
        error: error.message || "Database connection failed" 
      });
    }
  });

  // Metrics endpoint (protected - requires auth or secret token)
  app.get("/metrics", (req, res) => {
    // Check for metrics secret token or require authentication
    const metricsToken = req.headers['x-metrics-token'];
    const validToken = process.env.METRICS_TOKEN;
    
    // Allow access if token matches or if no token is set (development)
    if (validToken && metricsToken !== validToken) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const queueStatus = getQueueStatus();
    
    res.json({
      requests: {
        total: metrics.requests.total,
        byEndpoint: Object.fromEntries(metrics.requests.byEndpoint),
        byStatus: Object.fromEntries(metrics.requests.byStatus),
      },
      auth: metrics.auth,
      posts: metrics.posts,
      ai: metrics.ai,
      connections: {
        total: metrics.connections.total,
        byPlatform: Object.fromEntries(metrics.connections.byPlatform),
      },
      queue: {
        available: queueStatus.available,
        reason: queueStatus.reason,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  // Metrics middleware - track all requests
  app.use((req, res, next) => {
    metrics.requests.total++;
    const endpoint = `${req.method} ${req.path}`;
    metrics.requests.byEndpoint.set(endpoint, (metrics.requests.byEndpoint.get(endpoint) || 0) + 1);
    
    const originalSend = res.send;
    res.send = function(data) {
      metrics.requests.byStatus.set(res.statusCode, (metrics.requests.byStatus.get(res.statusCode) || 0) + 1);
      return originalSend.call(this, data);
    };
    
    next();
  });

  // Apply general rate limiting to all API routes
  app.use("/api", generalRateLimiter);

  // Auth endpoints
  app.post("/api/auth/signup", authRateLimiter, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      
      // Create user (manually construct insert object with passwordHash)
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash,
      } as any);
      
      // Generate JWT
      const token = signToken({ userId: user.id, email: user.email });
      
      // Set cookies if feature is enabled
      const tokens = generateTokens({ userId: user.id, email: user.email });
      setAuthCookies(res, tokens);
      
      metrics.auth.signups++;
      
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
      metrics.auth.failures++;
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Generate JWT
      const token = signToken({ userId: user.id, email: user.email });
      
      // Set cookies if feature is enabled
      const tokens = generateTokens({ userId: user.id, email: user.email });
      setAuthCookies(res, tokens);
      
      metrics.auth.logins++;
      
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
      metrics.auth.failures++;
      res.status(400).json({ error: error.message });
    }
  });

  // Token refresh endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      
      if (!refreshToken) {
        return res.status(401).json({ error: "No refresh token provided" });
      }
      
      // Verify refresh token
      const payload = verifyToken(refreshToken);
      
      // Generate new tokens
      const tokens = generateTokens({ userId: payload.userId, email: payload.email });
      
      // Set new cookies (token rotation)
      setAuthCookies(res, tokens);
      
      res.json({ 
        success: true,
        user: { id: payload.userId, email: payload.email }
      });
    } catch (error: any) {
      // Clear invalid cookies
      clearAuthCookies(res);
      res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  });

  // Connection endpoints
  app.get("/api/connections", requireAuth, async (req: AuthRequest, res) => {
    try {
      const connections = await storage.getConnections(req.userId!);
      
      // Remove encrypted tokens from response
      const sanitized = connections.map(c => ({
        id: c.id,
        userId: c.userId,
        platform: c.platform,
        scopes: c.scopes,
        tokenType: c.tokenType,
        expiresAt: c.expiresAt,
        accountId: c.accountId,
        accountHandle: c.accountHandle,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/connect/:platform", requireAuth, oauthRateLimiter, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as Platform;
      
      // Check if platform is configured
      if (!isPlatformConfigured(platform)) {
        const error = getConfigurationError(platform);
        return res.status(400).json({ error });
      }
      
      // Generate PKCE challenge
      const { code_verifier, code_challenge } = await generatePKCE();
      
      // Generate state
      const state: OAuthState = {
        userId: req.userId!,
        platform,
        codeVerifier: code_verifier,
        timestamp: Date.now(),
      };
      const stateToken = Buffer.from(JSON.stringify(state)).toString("base64url");
      
      // Store state (expires in 10 minutes)
      await oauthStateStore.set(stateToken, state, 600);
      
      // Get OAuth provider
      const provider = getOAuthProvider(platform);
      
      // Generate auth URL
      const authUrl = provider.generateAuthUrl(stateToken, code_challenge);
      
      res.json({ redirectUrl: authUrl });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/callback/:platform", async (req, res) => {
    try {
      const platform = req.params.platform as Platform;
      const { code, state: stateToken } = req.query;
      
      if (!code || !stateToken) {
        return res.status(400).json({ error: "Missing code or state" });
      }
      
      // Verify state
      const state = await oauthStateStore.get(stateToken as string) as OAuthState | null;
      if (!state) {
        return res.status(400).json({ error: "Invalid or expired state" });
      }
      
      // Verify platform matches
      if (state.platform !== platform) {
        return res.status(400).json({ error: "Platform mismatch" });
      }
      
      // Delete state
      await oauthStateStore.delete(stateToken as string);
      
      // Get OAuth provider
      const provider = getOAuthProvider(platform);
      
      // Exchange code for tokens
      const tokens = await provider.exchangeCodeForTokens(
        code as string,
        state.codeVerifier
      );
      
      // Encrypt tokens
      const accessTokenEnc = encryptToken(tokens.accessToken);
      const refreshTokenEnc = tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined;
      
      // Calculate expiration
      const expiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined;
      
      // Check if connection already exists
      const existing = await storage.getConnection(state.userId, platform);
      
      if (existing) {
        // Update existing connection
        await storage.updateConnection(existing.id, {
          accessTokenEnc,
          refreshTokenEnc,
          tokenType: tokens.tokenType,
          expiresAt,
          scopes: tokens.scope?.split(" ") || existing.scopes,
        });
      } else {
        // Create new connection
        await storage.createConnection({
          userId: state.userId,
          platform,
          scopes: tokens.scope?.split(" ") || [],
          accessTokenEnc,
          refreshTokenEnc,
          tokenType: tokens.tokenType,
          expiresAt,
        });
        
        metrics.connections.total++;
        metrics.connections.byPlatform.set(platform, (metrics.connections.byPlatform.get(platform) || 0) + 1);
      }
      
      // Redirect to frontend using validated redirect URI
      const successRedirect = getSafeRedirectUri(undefined, "/connections?success=true");
      res.redirect(successRedirect);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      const errorRedirect = getSafeRedirectUri(undefined, `/connections?error=${encodeURIComponent(error.message)}`);
      res.redirect(errorRedirect);
    }
  });

  app.post("/api/disconnect/:platform", requireAuth, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as Platform;
      
      const connection = await storage.getConnection(req.userId!, platform);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      // Decrypt access token
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Try to revoke token
      try {
        const provider = getOAuthProvider(platform);
        await provider.revokeToken(accessToken);
      } catch (error) {
        // Ignore revocation errors
        console.error("Token revocation error:", error);
      }
      
      // Delete connection
      await storage.deleteConnection(connection.id);
      
      res.json({ message: "Connection removed" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Post endpoints
  app.post("/api/posts/draft", requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        caption: z.string().min(1),
        mediaUrl: z.string().optional(),
      });
      
      const data = schema.parse(req.body);
      
      // Create a draft post (no platform specified, just saves the content)
      metrics.posts.created++;
      
      const post = await storage.createPost({
        userId: req.userId!,
        platform: 'instagram', // Default platform for drafts
        caption: data.caption,
        mediaType: data.mediaUrl ? 'image' : undefined,
        mediaUrl: data.mediaUrl,
        scheduledAt: undefined,
        options: null,
        status: 'draft' as const,
      });
      
      res.json(post);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/posts", requireAuth, postCreationRateLimiter, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        platform: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
        caption: z.string().min(1),
        media: z.object({
          type: z.enum(["image", "video"]),
          url: z.string().min(1), // Accept both absolute URLs and relative paths
        }).optional(),
        options: z.any().optional(),
        status: z.enum(["draft", "queued", "publishing", "published", "failed"]).optional(),
      });
      
      const data = schema.parse(req.body);
      const isDraft = data.status === "draft";
      
      // Normalize media URL - convert relative paths to absolute URLs
      let normalizedMediaUrl = data.media?.url;
      if (normalizedMediaUrl && normalizedMediaUrl.startsWith('/objects/')) {
        // Convert relative object storage path to absolute URL
        const protocol = req.protocol;
        const host = req.get('host');
        normalizedMediaUrl = `${protocol}://${host}${normalizedMediaUrl}`;
      }
      
      // Check connection exists (skip for drafts)
      let connection = null;
      if (!isDraft) {
        connection = await storage.getConnection(req.userId!, data.platform);
        if (!connection) {
          return res.status(400).json({ error: `No ${data.platform} connection found` });
        }
      }
      
      // Create post
      const post = await storage.createPost({
        userId: req.userId!,
        platform: data.platform,
        caption: data.caption,
        mediaType: data.media?.type,
        mediaUrl: normalizedMediaUrl,
        scheduledAt: undefined,
        options: data.options || null,
        status: isDraft ? "draft" : "queued",
      });
      
      // Skip publishing for draft posts
      if (isDraft) {
        return res.json(post);
      }
      
      // Publish immediately to all platforms
      try {
        const accessToken = decryptToken(connection!.accessTokenEnc);
        const result = await publishToPlatform(
          data.platform,
          accessToken,
          data.caption,
          normalizedMediaUrl,
          data.media?.type,
          data.options
        );
        
        await storage.updatePost(post.id, {
          status: "published",
          externalId: result.id,
          externalUrl: result.url,
        });
        
        await storage.createJobLog({
          postId: post.id,
          level: "info",
          message: `Published to ${data.platform} successfully`,
          raw: result,
        });
      } catch (error: any) {
        await storage.updatePost(post.id, {
          status: "failed",
        });
        
        await storage.createJobLog({
          postId: post.id,
          level: "error",
          message: error.message,
          raw: { error: error.message },
        });
        
        return res.status(500).json({ error: `Failed to publish: ${error.message}` });
      }
      
      const updatedPost = await storage.getPost(post.id);
      res.json(updatedPost);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Helper function for preflight checks
  async function runPreflightChecks(
    userId: string,
    platforms: Array<{ provider: Platform; boardId?: string }>
  ): Promise<Array<{ provider: Platform; connected: boolean; issues: string[]; boardId?: string }>> {
    const results = [];
    
    for (const platformConfig of platforms) {
      const { provider, boardId } = platformConfig;
      const issues: string[] = [];
      
      // Check if connection exists
      const connection = await storage.getConnection(userId, provider);
      const connected = !!connection;
      
      if (!connected) {
        issues.push(`No ${provider} connection found`);
      }
      
      // Platform-specific required fields
      if (provider === "pinterest" && !boardId) {
        issues.push("Pinterest requires a board selection");
      }
      
      results.push({
        provider,
        connected,
        issues,
        boardId,
      });
    }
    
    return results;
  }

  app.post("/api/schedule", requireAuth, async (req: AuthRequest, res) => {
    try {
      const featureEnabled = process.env.FEATURE_SCHEDULE_PENDING === "true";
      
      // New schema for feature-flagged endpoint
      if (featureEnabled) {
        const schema = z.object({
          postId: z.string().optional(),
          caption: z.string().min(1),
          media: z.object({
            type: z.enum(["image", "video"]),
            url: z.string(),
          }).optional(),
          scheduledAt: z.string(),
          platforms: z.array(z.object({
            provider: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
            boardId: z.string().optional(),
          })),
          tone: z.string().optional(),
          language: z.string().optional(),
          category: z.string().optional(),
        });
        
        const data = schema.parse(req.body);
        const scheduledAt = new Date(data.scheduledAt);
        
        // Validate scheduled time is in the future
        if (scheduledAt <= new Date()) {
          return res.status(400).json({ error: "Scheduled time must be in the future" });
        }
        
        // Run preflight checks
        const preflightResults = await runPreflightChecks(req.userId!, data.platforms);
        
        // Determine if all platforms are ready
        const allReady = preflightResults.every(r => r.connected && r.issues.length === 0);
        
        // Build options object for tone/language/category
        const options: any = {};
        if (data.tone) options.tone = data.tone;
        if (data.language) options.language = data.language;
        if (data.category) options.category = data.category;
        
        // Create or update post
        const postData = {
          userId: req.userId!,
          platform: data.platforms[0].provider, // Primary platform for backward compatibility
          caption: data.caption,
          mediaType: data.media?.type,
          mediaUrl: data.media?.url,
          scheduledAt,
          status: allReady ? ("scheduled" as const) : ("scheduled_pending" as const),
          platforms: data.platforms,
          preflightIssues: allReady ? null : preflightResults.filter(r => r.issues.length > 0),
          jobId: null,
          options: Object.keys(options).length > 0 ? options : undefined,
        };
        
        let post;
        if (data.postId) {
          // Update existing post
          post = await storage.updatePost(data.postId, postData);
        } else {
          // Create new post
          post = await storage.createPost(postData);
        }
        
        // If all ready, enqueue the job
        if (allReady) {
          try {
            const queueStatus = getQueueStatus();
            if (queueStatus.available) {
              const job = await publishQueue!.add(
                `publish-${post.id}`,
                {
                  postId: post.id,
                  userId: req.userId!,
                  platform: data.platforms[0].provider,
                  caption: data.caption,
                  mediaUrl: data.media?.url,
                  mediaType: data.media?.type,
                  options: data.platforms[0],
                },
                {
                  delay: scheduledAt.getTime() - Date.now(),
                  jobId: `post-${post.id}`,
                }
              );
              
              await storage.updatePost(post.id, { jobId: job.id });
              
              await storage.createJobLog({
                postId: post.id,
                level: "info",
                message: `Scheduled for ${scheduledAt.toISOString()}`,
                raw: { scheduledAt: data.scheduledAt },
              });
              
              await trackEvent(
                req.userId!,
                "post_scheduled",
                "Post scheduled",
                { platform: data.platforms[0].provider, postId: post.id }
              );
            }
          } catch (queueError: any) {
            console.warn("Queue error:", queueError.message);
            await storage.createJobLog({
              postId: post.id,
              level: "warn",
              message: `Queue unavailable: ${queueError.message}`,
              raw: { error: queueError.message },
            });
          }
        }
        
        res.json({
          id: post.id,
          status: post.status,
          scheduledAt: post.scheduledAt,
          platforms: data.platforms.map(p => p.provider),
          issues: postData.preflightIssues,
        });
      } else {
        // Legacy behavior (FEATURE_SCHEDULE_PENDING=false)
        const schema = z.object({
          platform: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
          caption: z.string().min(1),
          media: z.object({
            type: z.enum(["image", "video"]),
            url: z.string().url(),
          }).optional(),
          scheduledAtISO: z.string(),
          options: z.any().optional(),
        });
        
        const data = schema.parse(req.body);
        
        // Check connection exists
        const connection = await storage.getConnection(req.userId!, data.platform);
        if (!connection) {
          return res.status(400).json({ error: `No ${data.platform} connection found` });
        }
        
        const scheduledAt = new Date(data.scheduledAtISO);
        
        // Validate scheduled time is in the future
        if (scheduledAt <= new Date()) {
          return res.status(400).json({ error: "Scheduled time must be in the future" });
        }
        
        // Create post
        const post = await storage.createPost({
          userId: req.userId!,
          platform: data.platform,
          caption: data.caption,
          mediaType: data.media?.type,
          mediaUrl: data.media?.url,
          scheduledAt,
          options: data.options || null,
        });
        
        // Add to BullMQ queue with scheduled time
        try {
          const queueStatus = getQueueStatus();
          if (!queueStatus.available) {
            throw new Error(`Job queue unavailable: ${queueStatus.reason}. Scheduled posts are not supported.`);
          }
          
          await publishQueue!.add(
            `publish-${post.id}`,
            {
              postId: post.id,
              userId: req.userId!,
              platform: data.platform,
              caption: data.caption,
              mediaUrl: data.media?.url,
              mediaType: data.media?.type,
              options: data.options,
            },
            {
              delay: scheduledAt.getTime() - Date.now(),
              jobId: `post-${post.id}`, // Idempotency: prevent duplicate jobs
            }
          );
          
          await storage.createJobLog({
            postId: post.id,
            level: "info",
            message: `Scheduled for ${scheduledAt.toISOString()}`,
            raw: { scheduledAt: data.scheduledAtISO },
          });
          
          // Track post_scheduled event
          await trackEvent(
            req.userId!,
            "post_scheduled",
            "Post scheduled",
            { platform: data.platform, postId: post.id }
          );
        } catch (queueError: any) {
          console.warn("Queue error (post saved but not queued):", queueError.message);
          // Post is still created, just log the queue failure
          await storage.createJobLog({
            postId: post.id,
            level: "warn",
            message: `Post created but queue unavailable: ${queueError.message}`,
            raw: { error: queueError.message },
          });
        }
        
        res.json(post);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get calendar view of scheduled posts
  app.get("/api/calendar", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { month } = req.query;
      
      if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "Invalid month format. Use YYYY-MM" });
      }
      
      // Parse month and calculate date range
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);
      
      // Get all posts for the user in this month
      const allPosts = await storage.getPosts(req.userId!);
      
      // Filter posts within the month
      const postsInMonth = allPosts.filter(post => {
        if (!post.scheduledAt) return false;
        const scheduledDate = new Date(post.scheduledAt);
        return scheduledDate >= startDate && scheduledDate <= endDate;
      });
      
      // Format response
      const calendarPosts = postsInMonth.map(post => ({
        id: post.id,
        status: post.status,
        scheduledAt: post.scheduledAt,
        platforms: post.platforms || [post.platform],
        caption: post.caption.substring(0, 80) + (post.caption.length > 80 ? "..." : ""),
        mediaUrl: post.mediaUrl,
      }));
      
      res.json(calendarPosts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get scheduled post details (for Preview)
  app.get("/api/schedule/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Get post
      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Get job logs for lastError
      const logs = await storage.getJobLogs(post.id);
      const errorLog = logs.find(log => log.level === "error");
      
      // Calculate character counts per platform
      const charCounts: Record<string, { current: number; limit: number }> = {};
      const platformCharLimits: Record<Platform, number> = {
        instagram: 2200,
        tiktok: 2200,
        twitter: 280,
        linkedin: 3000,
        pinterest: 500,
        youtube: 5000,
        facebook: 63206,
      };
      
      const platforms = (post.platforms || (post.platform ? [post.platform] : [])) as any[];
      platforms.forEach((platform: any) => {
        const platformName = typeof platform === 'string' ? platform : platform.provider;
        charCounts[platformName] = {
          current: post.caption.length,
          limit: platformCharLimits[platformName as Platform] || 1000,
        };
      });
      
      // Format media array
      const media = [];
      if (post.mediaUrl) {
        media.push({
          type: post.mediaType || "image",
          url: post.mediaUrl,
        });
      }
      
      // Extract options from jsonb field
      const options = (post.options as any) || {};
      
      res.json({
        id: post.id,
        caption: post.caption,
        scheduledAt: post.scheduledAt,
        media,
        platforms: platforms.map((p: any) => ({
          provider: typeof p === 'string' ? p : p.provider,
          status: post.status,
        })),
        charCounts,
        lastError: errorLog?.message || null,
        preflightIssues: (post as any).preflightIssues || null,
        tone: options.tone || null,
        language: options.language || null,
        category: options.category || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update scheduled post
  app.patch("/api/schedule/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Validation schema
      const schema = z.object({
        caption: z.string().optional(),
        media: z.object({
          type: z.enum(["image", "video"]),
          url: z.string(),
        }).optional(),
        scheduledAt: z.string().optional(),
        platforms: z.array(z.object({
          provider: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
          boardId: z.string().optional(),
        })).optional(),
        tone: z.string().optional(),
        language: z.string().optional(),
        category: z.string().optional(),
        boardId: z.string().optional(),
      });
      
      const data = schema.parse(req.body);
      
      // Get existing post
      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (existingPost.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Build update data
      const updateData: any = {};
      
      if (data.caption !== undefined) {
        updateData.caption = data.caption;
      }
      
      if (data.media !== undefined) {
        updateData.mediaType = data.media.type;
        updateData.mediaUrl = data.media.url;
      }
      
      if (data.scheduledAt !== undefined) {
        const scheduledAt = new Date(data.scheduledAt);
        
        // Validate scheduled time is in the future
        if (scheduledAt <= new Date()) {
          return res.status(400).json({ error: "Scheduled time must be in the future" });
        }
        
        updateData.scheduledAt = scheduledAt;
      }
      
      // Handle platforms update with preflight checks
      if (data.platforms !== undefined) {
        const preflightResults = await runPreflightChecks(req.userId!, data.platforms);
        const allReady = preflightResults.every(r => r.connected && r.issues.length === 0);
        
        updateData.platforms = data.platforms;
        updateData.platform = data.platforms[0].provider; // Update primary platform
        updateData.preflightIssues = allReady ? null : preflightResults.filter(r => r.issues.length > 0);
        updateData.status = allReady ? ("scheduled" as const) : ("scheduled_pending" as const);
      }
      
      // Handle tone/language/category in options
      if (data.tone !== undefined || data.language !== undefined || data.category !== undefined || data.boardId !== undefined) {
        const currentOptions = (existingPost.options as any) || {};
        updateData.options = {
          ...currentOptions,
          ...(data.tone !== undefined && { tone: data.tone }),
          ...(data.language !== undefined && { language: data.language }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.boardId !== undefined && { boardId: data.boardId }),
        };
      }
      
      // Handle job cancellation and re-enqueueing if scheduledAt changed
      const scheduledAtChanged = data.scheduledAt !== undefined;
      const hasJob = existingPost.jobId;
      
      if (scheduledAtChanged && hasJob) {
        try {
          const queueStatus = getQueueStatus();
          if (queueStatus.available && publishQueue) {
            // Try to get and remove the existing job
            const existingJob = await publishQueue.getJob(existingPost.jobId!);
            if (existingJob) {
              const state = await existingJob.getState();
              // Only remove if job is waiting or delayed (not active or completed)
              if (state === 'waiting' || state === 'delayed') {
                await existingJob.remove();
                await storage.createJobLog({
                  postId: id,
                  level: "info",
                  message: `Cancelled existing job due to reschedule`,
                  raw: { oldJobId: existingJob.id, oldScheduledAt: existingPost.scheduledAt },
                });
              }
            }
            updateData.jobId = null; // Clear job ID
          }
        } catch (jobError: any) {
          console.warn("Error cancelling existing job:", jobError.message);
        }
      }
      
      // Update the post
      const updatedPost = await storage.updatePost(id, updateData);
      
      // If post is now ready and has a scheduledAt, enqueue new job
      const shouldEnqueue = 
        (updatedPost.status === 'scheduled' || updateData.status === 'scheduled') &&
        updatedPost.scheduledAt &&
        !updatedPost.jobId;
      
      if (shouldEnqueue && updatedPost.scheduledAt) {
        try {
          const queueStatus = getQueueStatus();
          if (queueStatus.available && publishQueue) {
            const platforms = (updatedPost.platforms || [updatedPost.platform]) as any[];
            const primaryPlatform = typeof platforms[0] === 'string' ? platforms[0] : platforms[0].provider;
            const scheduledTime = new Date(updatedPost.scheduledAt);
            
            // Create idempotency key with timestamp to allow rescheduling
            const idempotencyKey = `post-${updatedPost.id}-${scheduledTime.getTime()}`;
            
            const job = await publishQueue.add(
              `publish-${updatedPost.id}`,
              {
                postId: updatedPost.id,
                userId: req.userId!,
                platform: primaryPlatform,
                caption: updatedPost.caption,
                mediaUrl: updatedPost.mediaUrl || undefined,
                mediaType: updatedPost.mediaType || undefined,
                options: typeof platforms[0] === 'object' ? platforms[0] : {},
              },
              {
                delay: scheduledTime.getTime() - Date.now(),
                jobId: idempotencyKey,
              }
            );
            
            await storage.updatePost(updatedPost.id, { jobId: job.id });
            
            await storage.createJobLog({
              postId: updatedPost.id,
              level: "info",
              message: `Updated and scheduled for ${scheduledTime.toISOString()}`,
              raw: { scheduledAt: scheduledTime.toISOString() },
            });
          }
        } catch (queueError: any) {
          console.warn("Queue error:", queueError.message);
        }
      }
      
      // Return updated post
      const finalPost = await storage.getPost(id);
      res.json({
        id: finalPost!.id,
        status: finalPost!.status,
        caption: finalPost!.caption,
        scheduledAt: finalPost!.scheduledAt,
        media: finalPost!.mediaUrl ? [{
          type: finalPost!.mediaType || 'image',
          url: finalPost!.mediaUrl,
        }] : [],
        platforms: (finalPost!.platforms || [finalPost!.platform]) as any[],
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Duplicate scheduled post
  app.post("/api/schedule/:id/duplicate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Get existing post
      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (existingPost.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Create duplicate with draft status
      const duplicateData = {
        userId: req.userId!,
        platform: existingPost.platform,
        caption: existingPost.caption,
        mediaType: existingPost.mediaType,
        mediaUrl: existingPost.mediaUrl,
        scheduledAt: null, // Duplicates start as drafts
        status: "draft" as const,
        platforms: existingPost.platforms as any,
        options: existingPost.options as any,
        preflightIssues: null,
      };
      
      const duplicate = await storage.createPost(duplicateData);
      
      await storage.createJobLog({
        postId: duplicate.id,
        level: "info",
        message: `Duplicated from post ${id}`,
        raw: { originalPostId: id },
      });
      
      res.json({
        id: duplicate.id,
        status: duplicate.status,
        message: "Post duplicated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Resolve pending scheduled post
  app.patch("/api/schedule/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { platforms } = req.body;
      
      if (!platforms || !Array.isArray(platforms)) {
        return res.status(400).json({ error: "platforms array required" });
      }
      
      // Get existing post
      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Re-run preflight checks with updated details
      const preflightResults = await runPreflightChecks(req.userId!, platforms);
      const allReady = preflightResults.every(r => r.connected && r.issues.length === 0);
      
      // Update post
      const updateData = {
        platforms,
        preflightIssues: allReady ? null : preflightResults.filter(r => r.issues.length > 0),
        status: allReady ? ("scheduled" as const) : ("scheduled_pending" as const),
      };
      
      const updatedPost = await storage.updatePost(id, updateData);
      
      // If now ready, enqueue job
      if (allReady && updatedPost.scheduledAt) {
        try {
          const queueStatus = getQueueStatus();
          if (queueStatus.available) {
            const job = await publishQueue!.add(
              `publish-${updatedPost.id}`,
              {
                postId: updatedPost.id,
                userId: req.userId!,
                platform: platforms[0].provider,
                caption: updatedPost.caption,
                mediaUrl: updatedPost.mediaUrl || undefined,
                mediaType: updatedPost.mediaType || undefined,
                options: platforms[0],
              },
              {
                delay: new Date(updatedPost.scheduledAt).getTime() - Date.now(),
                jobId: `post-${updatedPost.id}`,
              }
            );
            
            await storage.updatePost(updatedPost.id, { jobId: job.id });
            
            await storage.createJobLog({
              postId: updatedPost.id,
              level: "info",
              message: `Resolved and scheduled for ${updatedPost.scheduledAt.toISOString()}`,
              raw: { resolvedAt: new Date().toISOString() },
            });
          }
        } catch (queueError: any) {
          console.warn("Queue error:", queueError.message);
        }
      }
      
      res.json({
        id: updatedPost.id,
        status: updatedPost.status,
        scheduledAt: updatedPost.scheduledAt,
        platforms: platforms.map((p: any) => p.provider),
        issues: updateData.preflightIssues,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/posts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const posts = await storage.getPosts(req.userId!);
      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Draft endpoints
  app.get("/api/drafts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const drafts = await storage.getDrafts(req.userId!);
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drafts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const draftData = {
        userId: req.userId!,
        caption: req.body.caption,
        mediaUrls: req.body.mediaUrls || [],
        mediaType: req.body.mediaType || null,
        settings: req.body.settings || null,
      };
      
      const draft = await storage.createDraft(draftData);
      
      await trackEvent(
        req.userId!,
        "post_created",
        "Draft saved",
        { draftId: draft.id }
      );
      
      res.json(draft);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/drafts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const draft = await storage.getDraft(req.params.id);
      
      if (!draft || draft.userId !== req.userId!) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      const updateData: any = {};
      if (req.body.caption !== undefined) updateData.caption = req.body.caption;
      if (req.body.mediaUrls !== undefined) updateData.mediaUrls = req.body.mediaUrls;
      if (req.body.settings !== undefined) updateData.settings = req.body.settings;
      
      const updatedDraft = await storage.updateDraft(req.params.id, updateData);
      
      await trackEvent(
        req.userId!,
        "post_created",
        "Draft updated",
        { draftId: req.params.id }
      );
      
      res.json(updatedDraft);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/drafts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const draft = await storage.getDraft(req.params.id);
      
      if (!draft || draft.userId !== req.userId!) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      await storage.deleteDraft(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/posts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      await storage.deletePost(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/posts/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const logs = await storage.getJobLogs(post.id);
      
      res.json({
        status: post.status,
        externalId: post.externalId,
        externalUrl: post.externalUrl,
        logs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Simple endpoint for testing - posts to Facebook
  app.post("/post_to_fb", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Get Facebook connection
      const connection = await storage.getConnection(req.userId!, "facebook");
      if (!connection) {
        return res.status(400).json({ error: "No Facebook connection found. Please connect your Facebook account first." });
      }
      
      // Decrypt access token
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Publish to Facebook
      const result = await publishToPlatform(
        "facebook",
        accessToken,
        message
      );
      
      // Create post record
      const post = await storage.createPost({
        userId: req.userId!,
        platform: "facebook",
        caption: message,
        status: "published",
        clientPostId: result.id,
      });
      
      await storage.createJobLog({
        postId: post.id,
        level: "info",
        message: "Published to Facebook successfully",
        raw: result,
      });
      
      res.json({
        success: true,
        postId: result.id,
        url: result.url,
        message: "Posted to Facebook successfully!",
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: error.message,
        message: "Failed to post to Facebook",
      });
    }
  });

  // Helper function to classify image content
  async function classifyImageContent(imageParts: any[], ai: any): Promise<{ 
    primaryCategory: string; 
    detectedObjects: string[]; 
    confidence: number 
  }> {
    const classificationPrompt = `Analyze this image and categorize its primary subject matter. 
    
Choose the SINGLE most appropriate category from this list:
- Travel (landmarks, destinations, vacation spots, scenic views, tourism)
- Real Estate (houses, buildings, properties, interiors, architecture, rooms)
- E-commerce (products for sale, items, merchandise, consumer goods)
- Food (meals, dishes, cuisine, restaurants, cooking)
- Fashion (clothing, outfits, accessories, style, models wearing clothes)
- People (portraits, groups, activities, pets, animals that are NOT for sale)
- Nature (landscapes, wildlife, plants that are NOT part of real estate or travel)
- Other (anything that doesn't fit the above)

Also list the top 3-5 objects or subjects you see in the image.

Return as JSON with: "primaryCategory" (string), "detectedObjects" (array of strings), "confidence" (number 0-1)`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [...imageParts, { text: classificationPrompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: (await import("@google/genai")).Type.OBJECT,
          properties: {
            primaryCategory: { type: (await import("@google/genai")).Type.STRING },
            detectedObjects: { 
              type: (await import("@google/genai")).Type.ARRAY,
              items: { type: (await import("@google/genai")).Type.STRING }
            },
            confidence: { type: (await import("@google/genai")).Type.NUMBER },
          },
          required: ['primaryCategory', 'detectedObjects', 'confidence'],
        },
      },
    });

    const cleanJson = response.text.replace(/^```json\n/, '').replace(/\n```$/, '');
    return JSON.parse(cleanJson);
  }

  // Helper function to check if detected category matches selected category
  function isCategoryMatch(selectedCategory: string, detectedCategory: string, confidence: number): {
    isMatch: boolean;
    reason?: string;
  } {
    // Custom category always passes (user knows what they want)
    if (selectedCategory.toLowerCase() === 'custom') {
      return { isMatch: true };
    }

    // Confidence threshold - if AI is not confident, let it pass
    if (confidence < 0.6) {
      return { isMatch: true }; // Don't block on low confidence
    }

    const selected = selectedCategory.toLowerCase().replace(/[^a-z]/g, '');
    const detected = detectedCategory.toLowerCase();

    // Direct matches
    if (selected === 'realestate' && detected.includes('real estate')) return { isMatch: true };
    if (selected === 'ecommerce' && detected.includes('e-commerce')) return { isMatch: true };
    if (selected === detected) return { isMatch: true };

    // Related categories that can work together
    const compatibleGroups = [
      ['travel', 'nature', 'people'],
      ['fashion', 'people', 'e-commerce'],
      ['food', 'people'],
    ];

    for (const group of compatibleGroups) {
      if (group.includes(selected) && group.includes(detected)) {
        return { isMatch: true };
      }
    }

    // Mismatch
    return { 
      isMatch: false, 
      reason: `Image appears to be about "${detectedCategory}" but you selected "${selectedCategory}"`
    };
  }

  // Generate AI caption from images with category verification
  app.post("/api/ai/generate", requireAuth, aiGenerationRateLimiter, async (req: AuthRequest, res) => {
    try {
      const { imageUrls, prompt, category } = req.body;
      
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }
      
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }
      
      // Import Gemini library dynamically
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      // Fetch images and convert to base64
      const imageParts = await Promise.all(
        imageUrls.map(async (url: string) => {
          // Convert relative URLs to absolute URLs using the actual request protocol
          const absoluteUrl = url.startsWith('http') 
            ? url 
            : `${req.protocol}://${req.get('host')}${url}`;
          
          console.log("Fetching image from:", absoluteUrl);
          const response = await fetch(absoluteUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image from ${absoluteUrl}: ${response.statusText}`);
          }
          
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          return {
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          };
        })
      );

      // STEP 1: Classify image content to verify relevance
      const classification = await classifyImageContent(imageParts, ai);
      console.log("Image classification:", classification);

      // STEP 2: Check if detected category matches selected category
      const matchResult = isCategoryMatch(category || 'Custom', classification.primaryCategory, classification.confidence);
      
      if (!matchResult.isMatch) {
        // Return category mismatch warning instead of generating caption
        return res.status(200).json({
          categoryMismatch: true,
          detectedCategory: classification.primaryCategory,
          selectedCategory: category,
          detectedObjects: classification.detectedObjects,
          message: matchResult.reason || 
            `This image looks like ${classification.detectedObjects.join(', ')}, which doesn't match your selected category "${category}". Please upload an image that matches your category or switch to a different category.`,
        });
      }

      // STEP 3: Category matches - proceed with caption generation
      const instruction = `
        You have two tasks. First, create a brief, one-sentence factual summary of the image contents (e.g., "A photo of a golden retriever playing on a sunny beach."). This will be the 'imageSummary'.
        Second, follow the user's primary instruction to generate the main content. This will be the 'generatedContent'.
        The user's primary instruction is: "${prompt}"

        Return your response as a single, minified JSON object with two keys: "imageSummary" and "generatedContent". Do not include any other text, formatting, or markdown.
      `;
      
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...imageParts, { text: instruction }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              imageSummary: { type: Type.STRING },
              generatedContent: { type: Type.STRING },
            },
            required: ['imageSummary', 'generatedContent'],
          },
        },
      });
      
      const responseText = geminiResponse.text || '{}';
      const cleanJsonText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '');
      const resultJson = JSON.parse(cleanJsonText);
      
      metrics.ai.generations++;
      
      res.json({
        description: resultJson.generatedContent,
        metadata: resultJson.imageSummary,
        categoryMatch: true,
      });
    } catch (error: any) {
      metrics.ai.errors++;
      console.error("Error generating AI caption:", error);
      res.status(500).json({ error: error.message || "Failed to generate caption" });
    }
  });

  // Get Pinterest boards for a user
  app.get("/api/pinterest/boards", requireAuth, async (req: AuthRequest, res) => {
    try {
      const connection = await storage.getConnection(req.userId!, "pinterest");
      if (!connection) {
        return res.status(404).json({ error: "No Pinterest connection found" });
      }
      
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Fetch boards from Pinterest API with pagination
      const response = await fetch("https://api.pinterest.com/v5/boards?page_size=100", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pinterest API error:", response.status, errorText);
        throw new Error(`Pinterest API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Pinterest boards response:", JSON.stringify(data, null, 2));
      
      // If no boards found, provide helpful message
      if (!data.items || data.items.length === 0) {
        console.log("No Pinterest boards found. User may need to create a board on Pinterest.com first.");
      }
      
      res.json(data.items || []);
    } catch (error: any) {
      console.error("Error fetching Pinterest boards:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // E-commerce connection endpoints
  app.get("/api/ecommerce/connections", requireAuth, async (req: AuthRequest, res) => {
    try {
      const connections = await storage.getEcommerceConnections(req.userId!);
      
      // Remove encrypted tokens from response
      const sanitized = connections.map(c => ({
        id: c.id,
        userId: c.userId,
        platform: c.platform,
        scopes: c.scopes,
        tokenType: c.tokenType,
        expiresAt: c.expiresAt,
        storeId: c.storeId,
        storeName: c.storeName,
        storeUrl: c.storeUrl,
        lastSyncedAt: c.lastSyncedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ecommerce/connect/:platform", requireAuth, oauthRateLimiter, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as EcommercePlatform;
      const { shopDomain } = req.query; // For Shopify
      
      // Check if platform is configured
      if (!isPlatformConfigured(platform)) {
        const error = getConfigurationError(platform);
        return res.status(400).json({ error });
      }
      
      // Generate PKCE challenge
      const { code_verifier, code_challenge } = await generatePKCE();
      
      // Generate state
      const state: EcommerceOAuthState = {
        userId: req.userId!,
        platform,
        codeVerifier: code_verifier,
        timestamp: Date.now(),
      };
      
      // Add shop domain to state for Shopify
      if (shopDomain) {
        (state as any).shopDomain = shopDomain;
      }
      
      const stateToken = Buffer.from(JSON.stringify(state)).toString("base64url");
      
      // Store state (expires in 10 minutes)
      await oauthStateStore.set(stateToken, state, 600);
      
      // Get OAuth provider
      const provider = getEcommerceOAuthProvider(platform, shopDomain as string | undefined);
      
      // Generate auth URL
      const authUrl = provider.generateAuthUrl(stateToken, code_challenge);
      
      res.json({ redirectUrl: authUrl });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/ecommerce/callback/:platform", async (req, res) => {
    try {
      const platform = req.params.platform as EcommercePlatform;
      const { code, state: stateToken } = req.query;
      
      if (!code || !stateToken) {
        return res.status(400).json({ error: "Missing code or state" });
      }
      
      // Verify state
      const state = await oauthStateStore.get(stateToken as string) as EcommerceOAuthState | null;
      if (!state) {
        return res.status(400).json({ error: "Invalid or expired state" });
      }
      
      // Verify platform matches
      if (state.platform !== platform) {
        return res.status(400).json({ error: "Platform mismatch" });
      }
      
      // Delete state
      await oauthStateStore.delete(stateToken as string);
      
      // Get OAuth provider
      const shopDomain = (state as any).shopDomain;
      const provider = getEcommerceOAuthProvider(platform, shopDomain);
      
      // Exchange code for tokens
      const tokens = await provider.exchangeCodeForTokens(
        code as string,
        state.codeVerifier
      );
      
      // Get store info
      const storeInfo = await provider.getStoreInfo(tokens.accessToken);
      
      // Encrypt tokens
      const accessTokenEnc = encryptToken(tokens.accessToken);
      const refreshTokenEnc = tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined;
      
      // Calculate expiration
      const expiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined;
      
      // Check if connection already exists
      const existingConnections = await storage.getEcommerceConnections(state.userId);
      const existing = existingConnections.find(c => c.platform === platform && c.storeId === storeInfo.storeId);
      
      if (existing) {
        // Update existing connection
        await storage.updateEcommerceConnection(existing.id, {
          accessTokenEnc,
          refreshTokenEnc,
          expiresAt,
          scopes: tokens.scope?.split(" ") || [],
          storeName: storeInfo.storeName,
          storeUrl: storeInfo.storeUrl,
        });
      } else {
        // Create new connection
        await storage.createEcommerceConnection({
          userId: state.userId,
          platform,
          scopes: tokens.scope?.split(" ") || [],
          accessTokenEnc,
          refreshTokenEnc,
          tokenType: tokens.tokenType,
          expiresAt,
          storeId: storeInfo.storeId,
          storeName: storeInfo.storeName,
          storeUrl: storeInfo.storeUrl,
        });
      }
      
      const successRedirect = getSafeRedirectUri(undefined, "/connections?success=true&type=ecommerce");
      res.redirect(successRedirect);
    } catch (error: any) {
      console.error("E-commerce OAuth callback error:", error);
      const errorRedirect = getSafeRedirectUri(undefined, `/connections?error=${encodeURIComponent(error.message)}`);
      res.redirect(errorRedirect);
    }
  });

  app.delete("/api/ecommerce/connections/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Verify connection belongs to user
      const connection = await storage.getEcommerceConnection(id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      if (connection.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      await storage.deleteEcommerceConnection(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Product endpoints
  app.get("/api/ecommerce/products/:connectionId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      
      // Verify connection belongs to user
      const connection = await storage.getEcommerceConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      if (connection.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const products = await storage.getProducts(connectionId);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ecommerce/products/sync/:connectionId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { connectionId } = req.params;
      
      // Verify connection belongs to user
      const connection = await storage.getEcommerceConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      if (connection.userId !== req.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Decrypt access token
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Get OAuth provider to fetch products
      const shopDomain = connection.storeUrl ? new URL(connection.storeUrl).hostname : undefined;
      const provider = getEcommerceOAuthProvider(connection.platform, shopDomain);
      
      // Fetch products from platform
      const platformProducts = await provider.getProducts(accessToken);
      
      // Delete existing products for this connection
      await storage.deleteProductsByConnection(connectionId);
      
      // Store products in database
      const savedProducts = await Promise.all(
        platformProducts.map(async (product: any) => {
          return await storage.createProduct({
            ecommerceConnectionId: connectionId,
            externalId: product.id,
            title: product.title,
            description: product.description || null,
            price: product.price || null,
            currency: product.currency || null,
            imageUrl: product.imageUrl || null,
            productUrl: product.productUrl || null,
            sku: product.sku || null,
            inventory: product.inventory || null,
            tags: product.tags || [],
            metadata: product.metadata || null,
          });
        })
      );
      
      // Update lastSyncedAt
      await storage.updateEcommerceConnection(connectionId, {
        lastSyncedAt: new Date(),
      });
      
      res.json({
        success: true,
        count: savedProducts.length,
        products: savedProducts,
      });
    } catch (error: any) {
      console.error("Product sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Token-based Shopify connection (simple method)
  app.post("/api/ecommerce/connect/shopify/token", requireAuth, oauthRateLimiter, async (req: AuthRequest, res) => {
    try {
      const { accessToken, shopDomain } = req.body;
      
      if (!accessToken || !shopDomain) {
        return res.status(400).json({ error: "Missing access token or shop domain" });
      }
      
      // Normalize shop domain
      let normalizedDomain = shopDomain.replace(/^https?:\/\//, "");
      if (!normalizedDomain.includes(".myshopify.com")) {
        normalizedDomain = `${normalizedDomain}.myshopify.com`;
      }
      
      // Test the token by fetching store info
      try {
        const shopResponse = await fetch(`https://${normalizedDomain}/admin/api/2025-01/shop.json`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
          },
        });
        
        if (!shopResponse.ok) {
          throw new Error("Invalid access token or shop domain");
        }
        
        const shopData = await shopResponse.json();
        const shop = shopData.shop;
        
        // Encrypt token
        const accessTokenEnc = encryptToken(accessToken);
        
        // Check if connection already exists
        const existingConnections = await storage.getEcommerceConnections(req.userId!);
        const existing = existingConnections.find(c => 
          c.platform === "shopify" && c.storeId === shop.id.toString()
        );
        
        if (existing) {
          // Update existing connection
          await storage.updateEcommerceConnection(existing.id, {
            accessTokenEnc,
            storeName: shop.name,
            storeUrl: shop.domain,
          });
          
          res.json({ 
            success: true, 
            connectionId: existing.id,
            message: "Shopify connection updated successfully" 
          });
        } else {
          // Create new connection
          const connection = await storage.createEcommerceConnection({
            userId: req.userId!,
            platform: "shopify",
            scopes: ["read_products", "read_orders", "read_inventory"],
            accessTokenEnc,
            tokenType: "Bearer",
            storeId: shop.id.toString(),
            storeName: shop.name,
            storeUrl: shop.domain,
          });
          
          res.json({ 
            success: true, 
            connectionId: connection.id,
            message: "Shopify connected successfully" 
          });
        }
      } catch (error: any) {
        throw new Error("Failed to connect to Shopify. Check your access token and shop domain.");
      }
    } catch (error: any) {
      console.error("Shopify token connection error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Image upload endpoints
  app.post("/api/upload/image", requireAuth, async (req: AuthRequest, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const result = await objectStorageService.getImageUploadURL();
      res.json(result);
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Presigned upload endpoint with validation
  app.post("/api/uploads/presign", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { contentType, fileSize, category } = req.body;

      if (!contentType || typeof contentType !== "string") {
        return res.status(400).json({ error: "contentType is required and must be a string" });
      }

      if (!fileSize || typeof fileSize !== "number") {
        return res.status(400).json({ error: "fileSize is required and must be a number" });
      }

      const objectStorageService = new ObjectStorageService();
      const result = await objectStorageService.getPresignedUploadURL({
        contentType,
        fileSize,
        category,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error generating presigned URL:", error);
      
      // Return validation errors with 400 status
      if (error.message.includes("Unsupported file type") || 
          error.message.includes("File size exceeds") ||
          error.message.includes("File size must be")) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  // Serve uploaded images
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // AI Generation endpoints (secure backend proxies)
  app.post("/api/ai/generate", requireAuth, aiGenerationRateLimiter, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        imageParts: z.array(z.object({
          inlineData: z.object({
            mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
            data: z.string(), // base64
          })
        })).min(1).max(10), // Max 10 images
        prompt: z.string().min(1).max(10000), // Max 10k chars
      });

      const data = schema.parse(req.body);

      // Validate base64 image size (decoded size should be < 20MB each)
      const maxSizeBytes = 20 * 1024 * 1024;
      for (const imagePart of data.imageParts) {
        const base64Size = imagePart.inlineData.data.length * 0.75; // Approximate decoded size
        if (base64Size > maxSizeBytes) {
          return res.status(400).json({ 
            error: `Image too large. Maximum size is 20MB (got ${(base64Size / 1024 / 1024).toFixed(2)}MB)` 
          });
        }
      }

      const result = await generateDescription(data.imageParts as ImagePart[], data.prompt);

      metrics.ai.generations++;
      
      res.json(result);
    } catch (error: any) {
      console.error("AI generation error:", error);
      metrics.ai.errors++;
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      
      res.status(500).json({ error: error.message || "Failed to generate description" });
    }
  });

  app.post("/api/ai/proofread", requireAuth, aiGenerationRateLimiter, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(50000), // Max 50k chars
      });

      const data = schema.parse(req.body);
      const result = await proofreadText(data.text);

      metrics.ai.generations++;
      
      res.json(result);
    } catch (error: any) {
      console.error("AI proofread error:", error);
      metrics.ai.errors++;
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      
      res.status(500).json({ error: error.message || "Failed to proofread text" });
    }
  });

  // Media Library endpoints
  app.get("/api/media", requireAuth, async (req: AuthRequest, res) => {
    try {
      const media = await storage.getMediaLibrary(req.userId!);
      res.json(media);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/media", requireAuth, async (req: AuthRequest, res) => {
    try {
      const media = await storage.createMedia({
        ...req.body,
        userId: req.userId!,
      });
      res.json(media);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/media/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      await storage.deleteMedia(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Templates endpoints
  app.get("/api/templates", requireAuth, async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getTemplates(req.userId!);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/templates", requireAuth, async (req: AuthRequest, res) => {
    try {
      const template = await storage.createTemplate({
        ...req.body,
        userId: req.userId!,
      });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      await storage.deleteTemplate(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Post Analytics endpoints
  app.get("/api/analytics", requireAuth, async (req: AuthRequest, res) => {
    try {
      const analytics = await storage.getPostAnalytics(req.userId!);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/summary", requireAuth, async (req: AuthRequest, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const events = await storage.getAnalyticsEvents(req.userId!, days);
      
      const summary: Record<string, number> = {
        caption_generated: 0,
        post_scheduled: 0,
        post_published: 0,
        publish_failed: 0,
      };
      
      events.forEach(event => {
        if (event.eventType in summary) {
          summary[event.eventType]++;
        }
      });
      
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/analytics/track", requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        eventType: z.enum(["caption_generated", "post_scheduled", "post_published", "publish_failed"]),
        eventName: z.string(),
        properties: z.record(z.any()).optional(),
      });
      
      const data = schema.parse(req.body);
      
      await trackEvent(
        req.userId!,
        data.eventType,
        data.eventName,
        data.properties,
        undefined,
        req.ip,
        req.get("user-agent")
      );
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin Audit Log endpoint
  app.get("/admin/audit", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Check if user is admin (using ADMIN_USER_IDS env var)
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(",") || [];
      if (!adminUserIds.includes(req.userId!)) {
        return res.status(403).json({ error: "Forbidden - admin access required" });
      }

      // Validate query parameters
      const querySchema = z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        userId: z.string().optional(),
        action: z.enum([
          "user.login",
          "user.logout",
          "user.register",
          "connection.create",
          "connection.delete",
          "ecommerce_connection.create",
          "ecommerce_connection.delete",
          "post.create",
          "post.update",
          "post.delete",
          "post.schedule",
          "post.publish",
          "draft.create",
          "draft.update",
          "draft.delete",
        ]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      });

      const validatedQuery = querySchema.parse(req.query);

      const page = parseInt(validatedQuery.page || "1");
      const limit = Math.min(parseInt(validatedQuery.limit || "50"), 200);
      const offset = (page - 1) * limit;

      // Get audit events with optional filters
      const auditEvents = await storage.getAuditEvents({
        userId: validatedQuery.userId,
        action: validatedQuery.action,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
        limit,
        offset,
      });

      const total = await storage.getAuditEventsCount({
        userId: validatedQuery.userId,
        action: validatedQuery.action,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
      });

      res.json({
        events: auditEvents,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook endpoints - handle platform callbacks
  app.get("/webhooks/:platform", async (req: RequestWithRawBody, res) => {
    try {
      const platform = req.params.platform as Platform;
      
      // Handle verification challenges for specific platforms
      if (platform === "facebook" || platform === "instagram") {
        const challenge = FacebookWebhookHandler.handleVerification(req);
        if (challenge) {
          return res.status(200).send(challenge);
        }
      } else if (platform === "twitter") {
        const responseToken = TwitterWebhookHandler.handleCRCChallenge(req);
        if (responseToken) {
          return res.status(200).json({ response_token: responseToken });
        }
      } else if (platform === "youtube") {
        const challenge = YouTubeWebhookHandler.handleSubscriptionVerification(req);
        if (challenge) {
          return res.status(200).send(challenge);
        }
      }
      
      res.status(400).json({ error: "Invalid verification request" });
    } catch (error: any) {
      console.error(`Webhook verification error for ${req.params.platform}:`, error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/webhooks/:platform", async (req: RequestWithRawBody, res) => {
    try {
      const platform = req.params.platform as Platform;
      
      const handler = WebhookHandlerFactory.getHandler(platform);
      if (!handler) {
        return res.status(404).json({ error: `No webhook handler for platform: ${platform}` });
      }

      const webhookEvent = await handler.handle(req);
      
      if (!webhookEvent) {
        return res.status(400).json({ error: "Invalid webhook event" });
      }

      const stored = await storage.createWebhookEvent(webhookEvent);
      
      console.log(`[Webhook] Received ${platform} event:`, webhookEvent.eventType);
      
      res.status(200).json({ success: true, id: stored.id });
    } catch (error: any) {
      console.error(`Webhook processing error for ${req.params.platform}:`, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
