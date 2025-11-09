// Reference: javascript_database blueprint
import {
  users,
  connections,
  ecommerceConnections,
  products,
  posts,
  drafts,
  jobLogs,
  mediaLibrary,
  templates,
  postAnalytics,
  analyticsEvents,
  auditEvents,
  webhookEvents,
  type User,
  type InsertUser,
  type Connection,
  type InsertConnection,
  type EcommerceConnection,
  type InsertEcommerceConnection,
  type Product,
  type InsertProduct,
  type Post,
  type InsertPost,
  type Draft,
  type InsertDraft,
  type JobLog,
  type InsertJobLog,
  type MediaLibrary,
  type InsertMediaLibrary,
  type Template,
  type InsertTemplate,
  type PostAnalytics,
  type InsertPostAnalytics,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type AuditEvent,
  type InsertAuditEvent,
  type WebhookEvent,
  type InsertWebhookEvent,
  type Platform,
  type EcommercePlatform,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Connection operations
  getConnections(userId: string): Promise<Connection[]>;
  getConnection(userId: string, platform: Platform): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnection(id: string, data: Partial<InsertConnection>): Promise<Connection>;
  deleteConnection(id: string): Promise<void>;
  
  // E-commerce connection operations
  getEcommerceConnections(userId: string): Promise<EcommerceConnection[]>;
  getEcommerceConnection(id: string): Promise<EcommerceConnection | undefined>;
  createEcommerceConnection(connection: InsertEcommerceConnection): Promise<EcommerceConnection>;
  updateEcommerceConnection(id: string, data: Partial<InsertEcommerceConnection>): Promise<EcommerceConnection>;
  deleteEcommerceConnection(id: string): Promise<void>;
  
  // Product operations
  getProducts(ecommerceConnectionId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  deleteProductsByConnection(ecommerceConnectionId: string): Promise<void>;
  
  // Post operations
  getPosts(userId: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, data: Partial<Post>): Promise<Post>;
  deletePost(id: string): Promise<void>;
  
  // Draft operations
  getDrafts(userId: string): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | undefined>;
  createDraft(draft: InsertDraft): Promise<Draft>;
  updateDraft(id: string, data: Partial<Draft>): Promise<Draft>;
  deleteDraft(id: string): Promise<void>;
  
  // Job log operations
  createJobLog(log: InsertJobLog): Promise<JobLog>;
  getJobLogs(postId: string): Promise<JobLog[]>;
  
  // Media library operations
  getMediaLibrary(userId: string): Promise<MediaLibrary[]>;
  createMedia(media: InsertMediaLibrary): Promise<MediaLibrary>;
  deleteMedia(id: string, userId: string): Promise<void>;
  
  // Template operations
  getTemplates(userId: string): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: string, userId: string): Promise<void>;
  
  // Analytics operations
  getPostAnalytics(userId: string): Promise<any[]>;
  getAnalyticsSummary(userId: string): Promise<any>;
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(userId: string, days?: number): Promise<AnalyticsEvent[]>;
  
  // Audit operations
  createAuditEvent(event: InsertAuditEvent): Promise<AuditEvent>;
  getAuditEvents(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]>;
  getAuditEventsCount(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  
  // Webhook operations
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;
  getWebhookEvents(filters: {
    platform?: Platform;
    eventType?: string;
    status?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WebhookEvent[]>;
  getPendingWebhookEvents(limit?: number): Promise<WebhookEvent[]>;
  updateWebhookEventStatus(id: string, status: string, errorMessage?: string | null): Promise<WebhookEvent>;
  markWebhookProcessed(id: string): Promise<WebhookEvent>;
  markWebhookFailed(id: string, errorMessage: string): Promise<WebhookEvent>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Connection operations
  async getConnections(userId: string): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(eq(connections.userId, userId))
      .orderBy(desc(connections.createdAt));
  }
  
  async getConnection(userId: string, platform: Platform): Promise<Connection | undefined> {
    const [connection] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.platform, platform)));
    return connection || undefined;
  }
  
  async createConnection(connection: InsertConnection): Promise<Connection> {
    const [newConnection] = await db
      .insert(connections)
      .values(connection)
      .returning();
    return newConnection;
  }
  
  async updateConnection(id: string, data: Partial<InsertConnection>): Promise<Connection> {
    const [updated] = await db
      .update(connections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(connections.id, id))
      .returning();
    return updated;
  }
  
  async deleteConnection(id: string): Promise<void> {
    await db.delete(connections).where(eq(connections.id, id));
  }
  
  // E-commerce connection operations
  async getEcommerceConnections(userId: string): Promise<EcommerceConnection[]> {
    return await db
      .select()
      .from(ecommerceConnections)
      .where(eq(ecommerceConnections.userId, userId))
      .orderBy(desc(ecommerceConnections.createdAt));
  }
  
  async getEcommerceConnection(id: string): Promise<EcommerceConnection | undefined> {
    const [connection] = await db
      .select()
      .from(ecommerceConnections)
      .where(eq(ecommerceConnections.id, id));
    return connection || undefined;
  }
  
  async createEcommerceConnection(connection: InsertEcommerceConnection): Promise<EcommerceConnection> {
    const [newConnection] = await db
      .insert(ecommerceConnections)
      .values(connection)
      .returning();
    return newConnection;
  }
  
  async updateEcommerceConnection(id: string, data: Partial<InsertEcommerceConnection>): Promise<EcommerceConnection> {
    const [updated] = await db
      .update(ecommerceConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ecommerceConnections.id, id))
      .returning();
    return updated;
  }
  
  async deleteEcommerceConnection(id: string): Promise<void> {
    await db.delete(ecommerceConnections).where(eq(ecommerceConnections.id, id));
  }
  
  // Product operations
  async getProducts(ecommerceConnectionId: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.ecommerceConnectionId, ecommerceConnectionId))
      .orderBy(desc(products.createdAt));
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values(product)
      .returning();
    return newProduct;
  }
  
  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }
  
  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }
  
  async deleteProductsByConnection(ecommerceConnectionId: string): Promise<void> {
    await db.delete(products).where(eq(products.ecommerceConnectionId, ecommerceConnectionId));
  }
  
  // Post operations
  async getPosts(userId: string): Promise<Post[]> {
    return await db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt));
  }
  
  async getPost(id: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post || undefined;
  }
  
  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db
      .insert(posts)
      .values(post)
      .returning();
    return newPost;
  }
  
  async updatePost(id: string, data: Partial<Post>): Promise<Post> {
    const [updated] = await db
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }
  
  async deletePost(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }
  
  // Draft operations
  async getDrafts(userId: string): Promise<Draft[]> {
    return await db
      .select()
      .from(drafts)
      .where(eq(drafts.userId, userId))
      .orderBy(desc(drafts.createdAt));
  }
  
  async getDraft(id: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
    return draft || undefined;
  }
  
  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await db
      .insert(drafts)
      .values(draft)
      .returning();
    return newDraft;
  }
  
  async updateDraft(id: string, data: Partial<Draft>): Promise<Draft> {
    const [updated] = await db
      .update(drafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(drafts.id, id))
      .returning();
    return updated;
  }
  
  async deleteDraft(id: string): Promise<void> {
    await db.delete(drafts).where(eq(drafts.id, id));
  }
  
  // Job log operations
  async createJobLog(log: InsertJobLog): Promise<JobLog> {
    const [newLog] = await db
      .insert(jobLogs)
      .values(log)
      .returning();
    return newLog;
  }
  
  async getJobLogs(postId: string): Promise<JobLog[]> {
    return await db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.postId, postId))
      .orderBy(desc(jobLogs.createdAt));
  }
  
  // Media library operations
  async getMediaLibrary(userId: string): Promise<MediaLibrary[]> {
    return await db
      .select()
      .from(mediaLibrary)
      .where(eq(mediaLibrary.userId, userId))
      .orderBy(desc(mediaLibrary.createdAt));
  }
  
  async createMedia(media: InsertMediaLibrary): Promise<MediaLibrary> {
    const [newMedia] = await db
      .insert(mediaLibrary)
      .values(media)
      .returning();
    return newMedia;
  }
  
  async deleteMedia(id: string, userId: string): Promise<void> {
    await db
      .delete(mediaLibrary)
      .where(and(eq(mediaLibrary.id, id), eq(mediaLibrary.userId, userId)));
  }
  
  // Template operations
  async getTemplates(userId: string): Promise<Template[]> {
    return await db
      .select()
      .from(templates)
      .where(eq(templates.userId, userId))
      .orderBy(desc(templates.createdAt));
  }
  
  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [newTemplate] = await db
      .insert(templates)
      .values(template)
      .returning();
    return newTemplate;
  }
  
  async deleteTemplate(id: string, userId: string): Promise<void> {
    await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, userId)));
  }
  
  // Analytics operations
  async getPostAnalytics(userId: string): Promise<any[]> {
    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId));
    
    const postIds = userPosts.map(p => p.id);
    
    if (postIds.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(postAnalytics)
      .where(sql`${postAnalytics.postId} = ANY(${postIds})`);
  }
  
  async getAnalyticsSummary(userId: string): Promise<any> {
    const userPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId));
    
    const totalPosts = userPosts.length;
    const publishedPosts = userPosts.filter(p => p.status === 'published').length;
    const scheduledPosts = userPosts.filter(p => p.status === 'queued').length;
    const failedPosts = userPosts.filter(p => p.status === 'failed').length;
    
    return {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      failedPosts,
      byPlatform: userPosts.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [analyticsEvent] = await db
      .insert(analyticsEvents)
      .values(event)
      .returning();
    return analyticsEvent;
  }

  async getAnalyticsEvents(userId: string, days: number = 30): Promise<AnalyticsEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, userId),
          sql`${analyticsEvents.createdAt} >= ${startDate}`
        )
      )
      .orderBy(desc(analyticsEvents.createdAt));
  }

  // Audit operations
  async createAuditEvent(event: InsertAuditEvent): Promise<AuditEvent> {
    const [auditEvent] = await db
      .insert(auditEvents)
      .values(event)
      .returning();
    return auditEvent;
  }

  async getAuditEvents(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(auditEvents.userId, filters.userId));
    }
    
    if (filters.action) {
      conditions.push(eq(auditEvents.action, filters.action as any));
    }
    
    if (filters.startDate) {
      conditions.push(sql`${auditEvents.createdAt} >= ${filters.startDate}`);
    }
    
    if (filters.endDate) {
      conditions.push(sql`${auditEvents.createdAt} <= ${filters.endDate}`);
    }

    let query = db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async getAuditEventsCount(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(auditEvents.userId, filters.userId));
    }
    
    if (filters.action) {
      conditions.push(eq(auditEvents.action, filters.action as any));
    }
    
    if (filters.startDate) {
      conditions.push(sql`${auditEvents.createdAt} >= ${filters.startDate}`);
    }
    
    if (filters.endDate) {
      conditions.push(sql`${auditEvents.createdAt} <= ${filters.endDate}`);
    }

    let query = db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(auditEvents);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;
    return result[0]?.count || 0;
  }

  // Webhook operations
  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const [webhookEvent] = await db
      .insert(webhookEvents)
      .values(event)
      .returning();
    return webhookEvent;
  }

  async getWebhookEvents(filters: {
    platform?: Platform;
    eventType?: string;
    status?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WebhookEvent[]> {
    const conditions = [];

    if (filters.platform) {
      conditions.push(eq(webhookEvents.platform, filters.platform));
    }

    if (filters.eventType) {
      conditions.push(eq(webhookEvents.eventType, filters.eventType as any));
    }

    if (filters.status) {
      conditions.push(eq(webhookEvents.status, filters.status as any));
    }

    if (filters.userId) {
      conditions.push(eq(webhookEvents.userId, filters.userId));
    }

    if (filters.startDate) {
      conditions.push(sql`${webhookEvents.createdAt} >= ${filters.startDate}`);
    }

    if (filters.endDate) {
      conditions.push(sql`${webhookEvents.createdAt} <= ${filters.endDate}`);
    }

    let query = db
      .select()
      .from(webhookEvents)
      .orderBy(desc(webhookEvents.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async getPendingWebhookEvents(limit: number = 50): Promise<WebhookEvent[]> {
    return await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.status, "pending"))
      .orderBy(webhookEvents.createdAt)
      .limit(limit);
  }

  async updateWebhookEventStatus(
    id: string,
    status: string,
    errorMessage?: string | null
  ): Promise<WebhookEvent> {
    const updateData: any = { status };

    if (status === "processed" || status === "failed") {
      updateData.processedAt = new Date();
    }

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    const [updated] = await db
      .update(webhookEvents)
      .set(updateData)
      .where(eq(webhookEvents.id, id))
      .returning();

    return updated;
  }

  async markWebhookProcessed(id: string): Promise<WebhookEvent> {
    const [updated] = await db
      .update(webhookEvents)
      .set({
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(webhookEvents.id, id))
      .returning();

    return updated;
  }

  async markWebhookFailed(id: string, errorMessage: string): Promise<WebhookEvent> {
    const [updated] = await db
      .update(webhookEvents)
      .set({
        status: "failed",
        processedAt: new Date(),
        errorMessage,
      })
      .where(eq(webhookEvents.id, id))
      .returning();

    return updated;
  }
}

export const storage = new DatabaseStorage();
