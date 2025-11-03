// Reference: javascript_database blueprint
import {
  users,
  connections,
  posts,
  jobLogs,
  mediaLibrary,
  templates,
  postAnalytics,
  type User,
  type InsertUser,
  type Connection,
  type InsertConnection,
  type Post,
  type InsertPost,
  type JobLog,
  type InsertJobLog,
  type MediaLibrary,
  type InsertMediaLibrary,
  type Template,
  type InsertTemplate,
  type PostAnalytics,
  type InsertPostAnalytics,
  type Platform,
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
  
  // Post operations
  getPosts(userId: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, data: Partial<Post>): Promise<Post>;
  deletePost(id: string): Promise<void>;
  
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
}

export const storage = new DatabaseStorage();
