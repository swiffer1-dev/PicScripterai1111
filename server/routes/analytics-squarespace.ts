import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db } from "../db";
import { posts } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

async function fetchSquarespaceDaily(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      date: sql<string>`DATE(${posts.createdAt})`,
      posts: sql<number>`COUNT(*)`,
      published: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'published')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'failed')`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        sql`${posts.platforms} @> '["squarespace"]'::jsonb`,
        gte(sql`DATE(${posts.createdAt})`, from),
        lte(sql`DATE(${posts.createdAt})`, to)
      )
    )
    .groupBy(sql`DATE(${posts.createdAt})`)
    .orderBy(sql`DATE(${posts.createdAt})`);

  return rows.map(r => ({
    date: r.date,
    posts: Number(r.posts) || 0,
    published: Number(r.published) || 0,
    failed: Number(r.failed) || 0,
  }));
}

function seriesFrom(rows: any[], key: string, label: string) {
  return {
    id: key,
    label,
    points: rows.map(r => ({ date: r.date, value: Number(r[key]) || 0 }))
  };
}

async function buildOverview(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
  const rows = await fetchSquarespaceDaily(userId, from, to);
  const sum = (k: string) => rows.reduce((a, r) => a + (Number((r as any)[k]) || 0), 0);
  
  // Generate full date range for revenue/orders series
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  
  const kpis = {
    posts: sum("posts"),
    published: sum("published"),
    failed: sum("failed"),
    likes: 0,
    reposts: 0,
    replies: 0,
    quotes: 0,
    revenue: 0, // Would come from Squarespace API
    orders: 0, // Would come from Squarespace API
  };
  
  const series = [
    seriesFrom(rows, "posts", "Posts"),
    seriesFrom(rows, "published", "Published"),
    seriesFrom(rows, "failed", "Failed"),
    { id: "revenue", label: "Revenue", points: dates.map(date => ({ date, value: 0 })) },
    { id: "orders", label: "Orders", points: dates.map(date => ({ date, value: 0 })) },
  ];
  
  return { platform: "squarespace", kpis, series };
}

export const squarespaceAnalyticsRouter = Router();
squarespaceAnalyticsRouter.use(requireAuth);

squarespaceAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  if (process.env.FEATURE_PER_PLATFORM_ANALYTICS !== "true") {
    return res.status(404).send("Feature not enabled");
  }
  
  const userId = req.user?.id!;
  const { from, to } = req.query as any;
  const today = new Date();
  const toIso = to ?? today.toISOString().slice(0, 10);
  const d = new Date(today);
  d.setDate(d.getDate() - 6);
  const fromIso = from ?? d.toISOString().slice(0, 10);
  
  const data = await buildOverview(userId, fromIso, toIso);
  res.json(data);
});

export default squarespaceAnalyticsRouter;
