import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, type AuthRequest } from "./middleware/auth";
import { 
  authRateLimiter, 
  generalRateLimiter, 
  aiGenerationRateLimiter,
  postCreationRateLimiter,
  oauthRateLimiter
} from "./middleware/rateLimiter";
import { signToken } from "./utils/jwt";
import { encryptToken, decryptToken } from "./utils/encryption";
import { getSafeRedirectUri } from "./utils/redirect-validator";
import { getOAuthProvider } from "./services/oauth/factory";
import { generatePKCE, type OAuthState } from "./services/oauth/base";
import { getEcommerceOAuthProvider } from "./services/ecommerce-oauth/factory";
import { type EcommerceOAuthState } from "./services/ecommerce-oauth/base";
import { publishToPlatform } from "./services/publishers";
import { publishQueue } from "./worker-queue";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { trackEvent } from "./utils/analytics";
import { oauthStateStore } from "./utils/oauth-state-store";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertPostSchema, type Platform, type EcommercePlatform } from "@shared/schema";

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
      // Check database connection by attempting to get any user (will work even if no users exist)
      // This validates the database connection is working
      await storage.getUserByEmail("healthcheck@test.local").catch(() => null);
      
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
    } catch (error) {
      res.status(503).json({ status: "not ready", error: "Database connection failed" });
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
      
      metrics.auth.logins++;
      
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
      metrics.auth.failures++;
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", authMiddleware, (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Connection endpoints
  app.get("/api/connections", authMiddleware, async (req: AuthRequest, res) => {
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

  app.get("/api/connect/:platform", authMiddleware, oauthRateLimiter, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as Platform;
      
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

  app.post("/api/disconnect/:platform", authMiddleware, async (req: AuthRequest, res) => {
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
  app.post("/api/posts/draft", authMiddleware, async (req: AuthRequest, res) => {
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

  app.post("/api/posts", authMiddleware, postCreationRateLimiter, async (req: AuthRequest, res) => {
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

  app.post("/api/schedule", authMiddleware, async (req: AuthRequest, res) => {
    try {
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
        await publishQueue.add(
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
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/posts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const posts = await storage.getPosts(req.userId!);
      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/posts/:id", authMiddleware, async (req: AuthRequest, res) => {
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

  app.get("/api/posts/:id/status", authMiddleware, async (req: AuthRequest, res) => {
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
  app.post("/post_to_fb", authMiddleware, async (req: AuthRequest, res) => {
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

  // Generate AI caption from images
  app.post("/api/ai/generate", authMiddleware, aiGenerationRateLimiter, async (req: AuthRequest, res) => {
    try {
      const { imageUrls, prompt } = req.body;
      
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
          const response = await fetch(url);
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
      
      const instruction = `
        You have two tasks. First, create a brief, one-sentence factual summary of the image contents (e.g., "A photo of a golden retriever playing on a sunny beach."). This will be the 'imageSummary'.
        Second, follow the user's primary instruction to generate the main content. This will be the 'generatedContent'.
        The user's primary instruction is: "${prompt}"

        Return your response as a single, minified JSON object with two keys: "imageSummary" and "generatedContent". Do not include any other text, formatting, or markdown.
      `;
      
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
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
      });
    } catch (error: any) {
      metrics.ai.errors++;
      console.error("Error generating AI caption:", error);
      res.status(500).json({ error: error.message || "Failed to generate caption" });
    }
  });

  // Get Pinterest boards for a user
  app.get("/api/pinterest/boards", authMiddleware, async (req: AuthRequest, res) => {
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
  app.get("/api/ecommerce/connections", authMiddleware, async (req: AuthRequest, res) => {
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

  app.get("/api/ecommerce/connect/:platform", authMiddleware, oauthRateLimiter, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as EcommercePlatform;
      const { shopDomain } = req.query; // For Shopify
      
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

  app.delete("/api/ecommerce/connections/:id", authMiddleware, async (req: AuthRequest, res) => {
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
  app.get("/api/ecommerce/products/:connectionId", authMiddleware, async (req: AuthRequest, res) => {
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

  app.post("/api/ecommerce/products/sync/:connectionId", authMiddleware, async (req: AuthRequest, res) => {
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
  app.post("/api/ecommerce/connect/shopify/token", authMiddleware, oauthRateLimiter, async (req: AuthRequest, res) => {
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
  app.post("/api/upload/image", authMiddleware, async (req: AuthRequest, res) => {
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
  app.post("/api/uploads/presign", authMiddleware, async (req: AuthRequest, res) => {
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

  // Media Library endpoints
  app.get("/api/media", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const media = await storage.getMediaLibrary(req.userId!);
      res.json(media);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/media", authMiddleware, async (req: AuthRequest, res) => {
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

  app.delete("/api/media/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteMedia(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Templates endpoints
  app.get("/api/templates", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getTemplates(req.userId!);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/templates", authMiddleware, async (req: AuthRequest, res) => {
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

  app.delete("/api/templates/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteTemplate(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Post Analytics endpoints
  app.get("/api/analytics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const analytics = await storage.getPostAnalytics(req.userId!);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/summary", authMiddleware, async (req: AuthRequest, res) => {
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

  app.post("/api/analytics/track", authMiddleware, async (req: AuthRequest, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
