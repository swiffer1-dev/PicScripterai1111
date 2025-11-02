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

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "queued",
  "publishing",
  "published",
  "failed",
]);

export const logLevelEnum = pgEnum("log_level", ["info", "warn", "error"]);

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  connections: many(connections),
  posts: many(posts),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  logs: many(jobLogs),
}));

export const jobLogsRelations = relations(jobLogs, ({ one }) => ({
  post: one(posts, {
    fields: [jobLogs.postId],
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;

export type Platform = typeof platformEnum.enumValues[number];
export type PostStatus = typeof postStatusEnum.enumValues[number];
export type LogLevel = typeof logLevelEnum.enumValues[number];
