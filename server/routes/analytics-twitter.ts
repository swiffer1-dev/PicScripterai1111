import { Router } from "express";
import type { AnalyticsOverview } from "../../shared/analytics";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import { db, sql } from "../storage";

async function fetchTwitterDaily(userId: string, from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const dailyData = await db.execute(sql`
    WITH date_series AS (
      SELECT generate_series(
        ${fromDate}::date,
        ${toDate}::date,
        '1 day'::interval
      )::date as date
    ),
    posts_data AS (
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'queued') as posts_scheduled,
        COUNT(*) FILTER (WHERE status = 'published') as posts_published,
        COUNT(*) FILTER (WHERE status = 'failed') as posts_failed
      FROM posts
      WHERE user_id = ${userId}
        AND 'twitter' = ANY(platforms)
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY DATE(created_at)
    ),
    metrics_data AS (
      SELECT DISTINCT ON (post_id)
        DATE(collected_at) as date,
        post_id,
        likes,
        reposts,
        replies,
        quotes
      FROM post_metrics
      WHERE user_id = ${userId}
        AND platform = 'twitter'
        AND collected_at >= ${fromDate}
        AND collected_at <= ${toDate}
      ORDER BY post_id, collected_at DESC
    ),
    aggregated_metrics AS (
      SELECT
        date,
        SUM(likes) as likes,
        SUM(reposts) as reposts,
        SUM(replies) as replies,
        SUM(quotes) as quotes
      FROM metrics_data
      GROUP BY date
    )
    SELECT
      ds.date::text,
      COALESCE(pd.posts_scheduled, 0)::int as posts,
      COALESCE(pd.posts_published, 0)::int as published,
      COALESCE(pd.posts_failed, 0)::int as failed,
      COALESCE(am.likes, 0)::int as likes,
      COALESCE(am.reposts, 0)::int as reposts,
      COALESCE(am.replies, 0)::int as replies,
      COALESCE(am.quotes, 0)::int as quotes
    FROM date_series ds
    LEFT JOIN posts_data pd ON ds.date = pd.date
    LEFT JOIN aggregated_metrics am ON ds.date = am.date
    ORDER BY ds.date
  `);

  return dailyData.rows as Array<{
    date: string;
    posts: number;
    published: number;
    failed: number;
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  }>;
}

async function buildOverview(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
  const rows = await fetchTwitterDaily(userId, from, to);

  const sum = (key: keyof typeof rows[0]) => 
    rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);

  const kpis = {
    posts: sum("posts"),
    published: sum("published"),
    failed: sum("failed"),
    likes: sum("likes"),
    replies: sum("replies"),
    reposts: sum("reposts"),
    quotes: sum("quotes"),
  };

  const makeSeries = (id: string, label: string) => ({
    id,
    label,
    points: rows.map(r => ({ 
      date: r.date, 
      value: Number((r as any)[id]) || 0 
    })),
  });

  const series = [
    makeSeries("posts", "Posts"),
    makeSeries("published", "Published"),
    makeSeries("likes", "Likes"),
    makeSeries("replies", "Replies"),
    makeSeries("reposts", "Reposts"),
    makeSeries("quotes", "Quotes"),
  ];

  return { platform: "twitter", kpis, series };
}

export const twitterAnalyticsRouter = Router();
twitterAnalyticsRouter.use(requireAuth);

twitterAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  if (process.env.METRICS_ENGAGEMENT !== "1") {
    return res.status(404).json({ error: "Feature disabled" });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { from, to } = req.query as { from?: string; to?: string };
    
    const today = new Date();
    const toIso = to ?? today.toISOString().slice(0, 10);
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    const fromIso = from ?? d.toISOString().slice(0, 10);

    const data = await buildOverview(userId, fromIso, toIso);
    res.json(data);
  } catch (error: any) {
    console.error("Twitter analytics error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default twitterAnalyticsRouter;
