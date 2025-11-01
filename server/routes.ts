import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, type AuthRequest } from "./middleware/auth";
import { signToken } from "./utils/jwt";
import { encryptToken, decryptToken } from "./utils/encryption";
import { getOAuthProvider } from "./services/oauth/factory";
import { generatePKCE, type OAuthState } from "./services/oauth/base";
import { publishToPlatform } from "./services/publishers";
import { publishQueue } from "./worker-queue";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { insertUserSchema, insertPostSchema, type Platform } from "@shared/schema";

// In-memory state store for OAuth flows (in production, use Redis)
const oauthStates = new Map<string, OAuthState>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoints
  app.get("/healthz", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/readyz", async (req, res) => {
    try {
      // Check database connection
      await storage.getUser("test");
      res.json({ status: "ready" });
    } catch (error) {
      res.status(503).json({ status: "not ready", error: "Database connection failed" });
    }
  });

  // Auth endpoints
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash,
      });
      
      // Generate JWT
      const token = signToken({ userId: user.id, email: user.email });
      
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
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
      
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error: any) {
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

  app.get("/api/connect/:platform", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const platform = req.params.platform as Platform;
      
      // Generate PKCE challenge
      const { code_verifier, code_challenge } = generatePKCE();
      
      // Generate state
      const state: OAuthState = {
        userId: req.userId!,
        platform,
        codeVerifier: code_verifier,
        timestamp: Date.now(),
      };
      const stateToken = Buffer.from(JSON.stringify(state)).toString("base64url");
      
      // Store state (expires in 10 minutes)
      oauthStates.set(stateToken, state);
      setTimeout(() => oauthStates.delete(stateToken), 10 * 60 * 1000);
      
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
      const state = oauthStates.get(stateToken as string);
      if (!state) {
        return res.status(400).json({ error: "Invalid or expired state" });
      }
      
      // Verify platform matches
      if (state.platform !== platform) {
        return res.status(400).json({ error: "Platform mismatch" });
      }
      
      // Delete state
      oauthStates.delete(stateToken as string);
      
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
      }
      
      // Redirect to frontend
      res.redirect(`${process.env.CORS_ORIGIN || "http://localhost:5000"}/connections?success=true`);
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`${process.env.CORS_ORIGIN || "http://localhost:5000"}/connections?error=${encodeURIComponent(error.message)}`);
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
  app.post("/api/posts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        platform: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
        caption: z.string().min(1),
        media: z.object({
          type: z.enum(["image", "video"]),
          url: z.string().min(1), // Accept both absolute URLs and relative paths
        }).optional(),
        options: z.any().optional(),
      });
      
      const data = schema.parse(req.body);
      
      // Normalize media URL - convert relative paths to absolute URLs
      let normalizedMediaUrl = data.media?.url;
      if (normalizedMediaUrl && normalizedMediaUrl.startsWith('/objects/')) {
        // Convert relative object storage path to absolute URL
        const protocol = req.protocol;
        const host = req.get('host');
        normalizedMediaUrl = `${protocol}://${host}${normalizedMediaUrl}`;
      }
      
      // Check connection exists
      const connection = await storage.getConnection(req.userId!, data.platform);
      if (!connection) {
        return res.status(400).json({ error: `No ${data.platform} connection found` });
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
      });
      
      // Publish immediately to all platforms
      try {
        const accessToken = decryptToken(connection.accessTokenEnc);
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
        externalId: result.id,
        externalUrl: result.url,
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

  // Get Pinterest boards for a user
  app.get("/api/pinterest/boards", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const connection = await storage.getConnection(req.userId!, "pinterest");
      if (!connection) {
        return res.status(404).json({ error: "No Pinterest connection found" });
      }
      
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Fetch boards from Pinterest API
      const response = await fetch("https://api.pinterest.com/v5/boards", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Pinterest API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      res.json(data.items || []);
    } catch (error: any) {
      console.error("Error fetching Pinterest boards:", error);
      res.status(500).json({ error: error.message });
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

  const httpServer = createServer(app);
  return httpServer;
}
