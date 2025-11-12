import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db } from "../db";
import { posts, connections } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { decryptToken } from "../utils/encryption";
import axios from "axios";

interface SquarespaceOrder {
  id: string;
  orderNumber: string;
  createdOn: string;
  customerEmail: string;
  grandTotal: {
    value: string;
    currency: string;
  };
}

interface SquarespaceOrdersResponse {
  result: SquarespaceOrder[];
  pagination: {
    hasNextPage: boolean;
    nextPageCursor?: string;
    nextPageUrl?: string;
  };
}

/**
 * Fetch orders from Squarespace API within a date range with pagination
 */
async function fetchSquarespaceOrders(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<SquarespaceOrder[]> {
  try {
    // Convert dates to ISO 8601 UTC datetime format
    const modifiedAfter = `${startDate}T00:00:00Z`;
    const modifiedBefore = `${endDate}T23:59:59Z`;
    
    const allOrders: SquarespaceOrder[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      const params: any = cursor 
        ? { cursor } // Subsequent requests use cursor only
        : { modifiedAfter, modifiedBefore }; // First request uses date filters
      
      const response = await axios.get<SquarespaceOrdersResponse>(
        "https://api.squarespace.com/1.0/commerce/orders",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": "Picscripterai/1.0",
          },
          params,
        }
      );
      
      const orders = response.data.result || [];
      allOrders.push(...orders);
      pageCount++;
      
      // Check pagination
      hasNextPage = response.data.pagination?.hasNextPage || false;
      cursor = response.data.pagination?.nextPageCursor || null;
      
      // If we got fewer orders than typical page size, we're likely done
      if (orders.length < 50) {
        hasNextPage = false;
      }
    }
    
    if (pageCount >= MAX_PAGES) {
      console.warn(`Squarespace pagination reached MAX_PAGES (${MAX_PAGES}), results may be incomplete`);
    }
    
    console.log(`Fetched ${allOrders.length} Squarespace orders across ${pageCount} pages`);
    return allOrders;
  } catch (error: any) {
    console.error("Error fetching Squarespace orders:", error.message);
    return [];
  }
}

/**
 * Calculate revenue metrics from orders
 */
function calculateRevenueMetrics(orders: SquarespaceOrder[]) {
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + parseFloat(order.grandTotal.value || "0");
  }, 0);
  
  const totalOrders = orders.length;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Count unique customer emails as new customers
  // Note: This is an approximation. True "new customers" would require
  // querying all historical orders for each email to check if this
  // is their first purchase ever. Squarespace API doesn't expose a simple
  // "is_first_time_buyer" field, so we use unique emails as a proxy.
  const uniqueEmails = new Set(
    orders
      .filter(o => o.customerEmail) // Filter out orders without email (POS/guest orders)
      .map(o => o.customerEmail.toLowerCase())
  );
  const newCustomers = uniqueEmails.size;
  
  return {
    revenue: totalRevenue,
    orders: totalOrders,
    aov,
    newCustomers,
  };
}

/**
 * Group orders by date and calculate daily metrics
 */
function groupOrdersByDate(orders: SquarespaceOrder[]) {
  const grouped = new Map<string, { revenue: number; orders: number }>();
  
  for (const order of orders) {
    const date = order.createdOn.slice(0, 10); // Extract YYYY-MM-DD
    const revenue = parseFloat(order.grandTotal.value || "0");
    
    if (!grouped.has(date)) {
      grouped.set(date, { revenue: 0, orders: 0 });
    }
    
    const day = grouped.get(date)!;
    day.revenue += revenue;
    day.orders += 1;
  }
  
  return Array.from(grouped.entries()).map(([date, metrics]) => ({
    date,
    revenue: metrics.revenue,
    orders: metrics.orders,
  }));
}

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
  
  // Fetch Squarespace connection to get access token
  const connection = await db.query.connections.findFirst({
    where: and(
      eq(connections.userId, userId),
      eq(connections.platform, "squarespace")
    ),
  });
  
  let revenueMetrics = { revenue: 0, orders: 0, aov: 0, newCustomers: 0 };
  let dailyData: Array<{ date: string; revenue: number; orders: number }> = [];
  
  if (connection?.encryptedAccessToken) {
    try {
      const accessToken = decryptToken(connection.encryptedAccessToken);
      const allOrders = await fetchSquarespaceOrders(accessToken, from, to);
      
      // Filter orders by createdOn date to only include orders created within the date range
      // (fetchSquarespaceOrders uses modifiedAfter/modifiedBefore which fetches orders
      // modified in the range, but we want orders created in the range)
      const orders = allOrders.filter(order => {
        const createdDate = order.createdOn.slice(0, 10); // YYYY-MM-DD
        return createdDate >= from && createdDate <= to;
      });
      
      if (orders.length > 0) {
        revenueMetrics = calculateRevenueMetrics(orders);
        dailyData = groupOrdersByDate(orders);
      }
    } catch (error) {
      console.error("Error fetching Squarespace revenue data:", error);
    }
  }
  
  // Create maps for quick lookup
  const revenueByDate = new Map(dailyData.map(d => [d.date, d.revenue]));
  const ordersByDate = new Map(dailyData.map(d => [d.date, d.orders]));
  
  const kpis = {
    posts: sum("posts"),
    published: sum("published"),
    failed: sum("failed"),
    likes: 0,
    reposts: 0,
    replies: 0,
    quotes: 0,
    revenue: revenueMetrics.revenue,
    orders: revenueMetrics.orders,
    aov: revenueMetrics.aov,
    newCustomers: revenueMetrics.newCustomers,
  };
  
  const series = [
    seriesFrom(rows, "posts", "Posts"),
    seriesFrom(rows, "published", "Published"),
    seriesFrom(rows, "failed", "Failed"),
    { 
      id: "revenue", 
      label: "Revenue", 
      points: dates.map(date => ({ date, value: revenueByDate.get(date) || 0 })) 
    },
    { 
      id: "orders", 
      label: "Orders", 
      points: dates.map(date => ({ date, value: ordersByDate.get(date) || 0 })) 
    },
  ];
  
  return { platform: "squarespace", kpis, series };
}

export const squarespaceAnalyticsRouter = Router();
squarespaceAnalyticsRouter.use(requireAuth);

squarespaceAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  if (process.env.FEATURE_PER_PLATFORM_ANALYTICS !== "true") {
    return res.status(404).send("Feature not enabled");
  }
  
  const userId = req.userId!;
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
