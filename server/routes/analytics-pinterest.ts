import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db } from "../db";
import { posts } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

async function fetchPinterestDaily(userId: string, from: string, to: string) {
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
        sql`'pinterest' = ANY(${posts.platforms})`,
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
    saves: 0,
    outbound_clicks: 0,
  }));
}

function s(rows: any[], key: string, label: string) {
  return {
    id: key,
    label,
    points: rows.map((r: any) => ({ date: r.date, value: Number(r[key]) || 0 }))
  };
}

async function buildOverview(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
  const rows = await fetchPinterestDaily(userId, from, to);
  const sum = (k: string) => rows.reduce((a, r) => a + (Number((r as any)[k]) || 0), 0);
  
  const kpis = {
    posts: sum("posts"),
    published: sum("published"),
    failed: sum("failed"),
    likes: sum("saves"),
    replies: 0,
    reposts: sum("outbound_clicks"),
  };
  
  const series = [
    s(rows, "posts", "Pins"),
    s(rows, "published", "Published"),
    s(rows, "saves", "Saves"),
    s(rows, "outbound_clicks", "Outbound Clicks"),
  ];
  
  return { platform: "pinterest", kpis, series };
}

export const pinterestAnalyticsRouter = Router();
pinterestAnalyticsRouter.use(requireAuth);

pinterestAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
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

export default pinterestAnalyticsRouter;
