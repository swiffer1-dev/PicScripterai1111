import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import { db } from "../db";
import { posts, postMetrics } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

/**
 * GET /api/insights/summary?days=7|30|90
 * Returns KPIs for PicScripter-created posts
 */
insightsRouter.get("/summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromIso = fromDate.toISOString();

    // Get post counts by status
    const postStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        published: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'published')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'failed')`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          gte(sql`${posts.createdAt}`, fromIso)
        )
      );

    const stats = postStats[0] || { total: 0, published: 0, failed: 0 };

    // Get engagement metrics
    const engagementStats = await db
      .select({
        totalLikes: sql<number>`COALESCE(SUM(${postMetrics.likes}), 0)`,
        totalReposts: sql<number>`COALESCE(SUM(${postMetrics.reposts}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${postMetrics.replies}), 0)`,
        totalQuotes: sql<number>`COALESCE(SUM(${postMetrics.quotes}), 0)`,
        postCount: sql<number>`COUNT(DISTINCT ${postMetrics.postId})`,
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          gte(sql`${postMetrics.collectedAt}`, fromIso)
        )
      );

    const engagement = engagementStats[0] || {
      totalLikes: 0,
      totalReposts: 0,
      totalReplies: 0,
      totalQuotes: 0,
      postCount: 0,
    };

    const totalEngagement = 
      Number(engagement.totalLikes) +
      Number(engagement.totalReposts) +
      Number(engagement.totalReplies) +
      Number(engagement.totalQuotes);

    const avgEngagementPerPost = Number(engagement.postCount) > 0
      ? totalEngagement / Number(engagement.postCount)
      : 0;

    // Get top tone from posts options
    const toneQuery = await db
      .select({
        tone: sql<string>`${posts.options}->>'tone'`,
        count: sql<number>`COUNT(*)`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          gte(sql`${posts.createdAt}`, fromIso),
          sql`${posts.options}->>'tone' IS NOT NULL`
        )
      )
      .groupBy(sql`${posts.options}->>'tone'`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1);

    const topTone = toneQuery[0]?.tone || "None";

    res.json({
      kpis: {
        postsCreated: Number(stats.total),
        published: Number(stats.published),
        failed: Number(stats.failed),
        avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
        topTone,
      },
    });
  } catch (error) {
    console.error("Error fetching insights summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

/**
 * GET /api/insights/engagement?days=7|30|90
 * Returns daily engagement metrics
 */
insightsRouter.get("/engagement", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromIso = fromDate.toISOString().slice(0, 10);

    const engagementData = await db
      .select({
        date: sql<string>`DATE(${postMetrics.collectedAt})`,
        likes: sql<number>`COALESCE(SUM(${postMetrics.likes}), 0)`,
        reposts: sql<number>`COALESCE(SUM(${postMetrics.reposts}), 0)`,
        replies: sql<number>`COALESCE(SUM(${postMetrics.replies}), 0)`,
        quotes: sql<number>`COALESCE(SUM(${postMetrics.quotes}), 0)`,
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          gte(sql`DATE(${postMetrics.collectedAt})`, fromIso)
        )
      )
      .groupBy(sql`DATE(${postMetrics.collectedAt})`)
      .orderBy(sql`DATE(${postMetrics.collectedAt})`);

    res.json(
      engagementData.map(row => ({
        date: row.date,
        likes: Number(row.likes),
        reposts: Number(row.reposts),
        replies: Number(row.replies),
        quotes: Number(row.quotes),
      }))
    );
  } catch (error) {
    console.error("Error fetching engagement data:", error);
    res.status(500).json({ error: "Failed to fetch engagement" });
  }
});

/**
 * GET /api/insights/tones?days=7|30|90
 * Returns tone performance metrics
 */
insightsRouter.get("/tones", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 7;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromIso = fromDate.toISOString();

    // Get posts with tones
    const toneData = await db
      .select({
        tone: sql<string>`${posts.options}->>'tone'`,
        count: sql<number>`COUNT(*)`,
        postIds: sql<string[]>`ARRAY_AGG(${posts.id})`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          gte(sql`${posts.createdAt}`, fromIso),
          sql`${posts.options}->>'tone' IS NOT NULL`
        )
      )
      .groupBy(sql`${posts.options}->>'tone'`);

    // Get engagement for each tone
    const tonesWithEngagement = await Promise.all(
      toneData.map(async (tone) => {
        const engagementStats = await db
          .select({
            totalEngagement: sql<number>`
              COALESCE(SUM(${postMetrics.likes}), 0) +
              COALESCE(SUM(${postMetrics.reposts}), 0) +
              COALESCE(SUM(${postMetrics.replies}), 0) +
              COALESCE(SUM(${postMetrics.quotes}), 0)
            `,
          })
          .from(postMetrics)
          .where(
            and(
              eq(postMetrics.userId, userId),
              sql`${postMetrics.postId} = ANY(${tone.postIds})`
            )
          );

        const totalEngagement = Number(engagementStats[0]?.totalEngagement || 0);
        const avgEngagement = Number(tone.count) > 0
          ? totalEngagement / Number(tone.count)
          : 0;

        return {
          tone: tone.tone,
          count: Number(tone.count),
          avgEngagement: Math.round(avgEngagement * 10) / 10,
        };
      })
    );

    res.json(tonesWithEngagement);
  } catch (error) {
    console.error("Error fetching tone data:", error);
    res.status(500).json({ error: "Failed to fetch tones" });
  }
});

/**
 * GET /api/insights/best-times?days=30
 * Returns heatmap data for best posting times
 */
insightsRouter.get("/best-times", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromIso = fromDate.toISOString();

    // Get published posts with their engagement
    const timeData = await db
      .select({
        postId: posts.id,
        publishedAt: posts.publishedAt,
        weekday: sql<number>`EXTRACT(DOW FROM ${posts.publishedAt})`, // 0 = Sunday, 6 = Saturday
        hour: sql<number>`EXTRACT(HOUR FROM ${posts.publishedAt})`,
      })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          eq(posts.status, "published"),
          gte(sql`${posts.publishedAt}`, fromIso),
          sql`${posts.publishedAt} IS NOT NULL`
        )
      );

    // Get engagement for each post
    const bucketMap = new Map<string, { posts: number; totalEngagement: number }>();

    for (const timeSlot of timeData) {
      const key = `${timeSlot.weekday}-${timeSlot.hour}`;
      
      // Get engagement for this post
      const engagementStats = await db
        .select({
          totalEngagement: sql<number>`
            COALESCE(SUM(${postMetrics.likes}), 0) +
            COALESCE(SUM(${postMetrics.reposts}), 0) +
            COALESCE(SUM(${postMetrics.replies}), 0) +
            COALESCE(SUM(${postMetrics.quotes}), 0)
          `,
        })
        .from(postMetrics)
        .where(eq(postMetrics.postId, timeSlot.postId))
        .limit(1);

      const engagement = Number(engagementStats[0]?.totalEngagement || 0);

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { posts: 0, totalEngagement: 0 });
      }

      const bucket = bucketMap.get(key)!;
      bucket.posts += 1;
      bucket.totalEngagement += engagement;
    }

    // Convert to array format
    const buckets = Array.from(bucketMap.entries()).map(([key, data]) => {
      const [weekday, hour] = key.split("-").map(Number);
      return {
        weekday,
        hour,
        posts: data.posts,
        avgEngagement: data.posts > 0
          ? Math.round((data.totalEngagement / data.posts) * 10) / 10
          : 0,
      };
    });

    res.json({
      tz: "UTC", // Could be enhanced to use user timezone
      buckets,
    });
  } catch (error) {
    console.error("Error fetching best times data:", error);
    res.status(500).json({ error: "Failed to fetch best times" });
  }
});

export default insightsRouter;
