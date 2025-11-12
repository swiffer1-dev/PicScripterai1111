import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db, sql } from "../storage";

async function fetchShopifyDaily(userId: number, from: string, to: string): Promise<AnalyticsOverview> {
  // NOTE: This is a read-only adapter querying the posts table
  // Real Shopify metrics (revenue, orders, etc.) would come from the Shopify API or products table
  // For now, we return structured empty data to demonstrate the UI
  
  const postCountsQuery = sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pending', 'published', 'failed')) AS posts,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed
    FROM posts
    WHERE user_id = ${userId}
      AND created_at::date BETWEEN ${from} AND ${to}
      AND 'shopify' = ANY(platforms)
  `;

  const [stats] = await db.execute(postCountsQuery);
  
  // Generate date series for charts (empty values for now)
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return {
    kpis: {
      posts: Number(stats?.posts ?? 0),
      published: Number(stats?.published ?? 0),
      failed: Number(stats?.failed ?? 0),
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      revenue: 0, // Would come from Shopify API
      orders: 0, // Would come from Shopify API
      aov: 0, // Would be calculated: revenue / orders
      newCustomers: 0, // Would come from Shopify API
      repeatRate: 0 // Would be calculated: repeat / total customers
    },
    series: [
      { id: "posts", points: dates.map(date => ({ date, value: 0 })) },
      { id: "published", points: dates.map(date => ({ date, value: 0 })) },
      { id: "revenue", points: dates.map(date => ({ date, value: 0 })) },
      { id: "orders", points: dates.map(date => ({ date, value: 0 })) }
    ]
  };
}

export const shopifyAnalyticsRouter = Router();
shopifyAnalyticsRouter.use(requireAuth);

shopifyAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  try {
    if (process.env.FEATURE_PER_PLATFORM_ANALYTICS !== "true") {
      return res.status(404).json({ error: "Feature not enabled" });
    }
    
    const userId = req.user?.id!;
    const { from, to } = req.query as { from?: string; to?: string };
    
    const today = new Date();
    const toDate = to ?? today.toISOString().slice(0, 10);
    const fromDate = from ?? (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return d.toISOString().slice(0, 10);
    })();
    
    const data = await fetchShopifyDaily(userId, fromDate, toDate);
    res.json(data);
  } catch (error: any) {
    console.error("Shopify analytics error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default shopifyAnalyticsRouter;
