import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const platformEnum = pgEnum("platform", [
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "pinterest",
  "youtube",
  "facebook",
]);

export const ecommercePlatformEnum = pgEnum("ecommerce_platform", [
  "shopify",
  "etsy",
  "squarespace",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "queued",
  "publishing",
  "published",
  "failed",
]);

export const logLevelEnum = pgEnum("log_level", ["info", "warn", "error"]);

export const mediaTypeEnum = pgEnum("media_type_enum", ["image", "video"]);

export const templateTypeEnum = pgEnum("template_type", ["caption", "brand_voice"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Connections table - stores OAuth tokens for social platforms
export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  scopes: text("scopes").array().notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenType: text("token_type").notNull().default("Bearer"),
  expiresAt: timestamp("expires_at"),
  accountId: text("account_id"),
  accountHandle: text("account_handle"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// E-commerce connections table - stores OAuth tokens for e-commerce platforms
export const ecommerceConnections = pgTable("ecommerce_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: ecommercePlatformEnum("platform").notNull(),
  scopes: text("scopes").array().notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenType: text("token_type").notNull().default("Bearer"),
  expiresAt: timestamp("expires_at"),
  storeId: text("store_id"),
  storeName: text("store_name"),
  storeUrl: text("store_url"),
  syncCursor: text("sync_cursor"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Products table - caches product listings from connected e-commerce stores
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ecommerceConnectionId: varchar("ecommerce_connection_id")
    .notNull()
    .references(() => ecommerceConnections.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  price: text("price"),
  currency: text("currency"),
  imageUrl: text("image_url"),
  productUrl: text("product_url"),
  sku: text("sku"),
  inventory: integer("inventory"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Posts table
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  caption: text("caption").notNull(),
  mediaType: text("media_type"),
  mediaUrl: text("media_url"),
  scheduledAt: timestamp("scheduled_at"),
  status: postStatusEnum("status").notNull().default("queued"),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  options: jsonb("options"),
  clientPostId: text("client_post_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Job logs table
export const jobLogs = pgTable("job_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  level: logLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Media library table
export const mediaLibrary = pgTable("media_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: mediaTypeEnum("file_type").notNull(),
  fileSize: integer("file_size"),
  width: integer("width"),
  height: integer("height"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Templates table
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: templateTypeEnum("type").notNull(),
  content: text("content").notNull(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Post analytics table
export const postAnalytics = pgTable("post_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  clicks: integer("clicks").default(0),
  reach: integer("reach").default(0),
  engagement: integer("engagement").default(0),
  lastFetchedAt: timestamp("last_fetched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  connections: many(connections),
  ecommerceConnections: many(ecommerceConnections),
  posts: many(posts),
  mediaLibrary: many(mediaLibrary),
  templates: many(templates),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id],
  }),
}));

export const ecommerceConnectionsRelations = relations(ecommerceConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [ecommerceConnections.userId],
    references: [users.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  ecommerceConnection: one(ecommerceConnections, {
    fields: [products.ecommerceConnectionId],
    references: [ecommerceConnections.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  logs: many(jobLogs),
  analytics: one(postAnalytics),
}));

export const jobLogsRelations = relations(jobLogs, ({ one }) => ({
  post: one(posts, {
    fields: [jobLogs.postId],
    references: [posts.id],
  }),
}));

export const mediaLibraryRelations = relations(mediaLibrary, ({ one }) => ({
  user: one(users, {
    fields: [mediaLibrary.userId],
    references: [users.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
}));

export const postAnalyticsRelations = relations(postAnalytics, ({ one }) => ({
  post: one(posts, {
    fields: [postAnalytics.postId],
    references: [posts.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEcommerceConnectionSchema = createInsertSchema(ecommerceConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  externalId: true,
  externalUrl: true,
});

export const insertJobLogSchema = createInsertSchema(jobLogs).omit({
  id: true,
  createdAt: true,
});

export const insertMediaLibrarySchema = createInsertSchema(mediaLibrary).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostAnalyticsSchema = createInsertSchema(postAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

export type EcommerceConnection = typeof ecommerceConnections.$inferSelect;
export type InsertEcommerceConnection = z.infer<typeof insertEcommerceConnectionSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;

export type MediaLibrary = typeof mediaLibrary.$inferSelect;
export type InsertMediaLibrary = z.infer<typeof insertMediaLibrarySchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type PostAnalytics = typeof postAnalytics.$inferSelect;
export type InsertPostAnalytics = z.infer<typeof insertPostAnalyticsSchema>;

export type Platform = typeof platformEnum.enumValues[number];
export type EcommercePlatform = typeof ecommercePlatformEnum.enumValues[number];
export type PostStatus = typeof postStatusEnum.enumValues[number];
export type LogLevel = typeof logLevelEnum.enumValues[number];
export type MediaType = typeof mediaTypeEnum.enumValues[number];
export type TemplateType = typeof templateTypeEnum.enumValues[number];
