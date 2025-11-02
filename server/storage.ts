// Reference: javascript_database blueprint
import {
  users,
  connections,
  posts,
  jobLogs,
  type User,
  type InsertUser,
  type Connection,
  type InsertConnection,
  type Post,
  type InsertPost,
  type JobLog,
  type InsertJobLog,
  type Platform,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
