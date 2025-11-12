import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db } from "../db";
import { posts, ecommerceConnections } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { decryptToken } from "../utils/encryption";
import axios from "axios";

interface EtsyReceipt {
  receipt_id: number;
  create_timestamp: number;
  grandtotal: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  buyer_user_id: number;
}

interface EtsyReceiptsResponse {
  count: number;
  results: EtsyReceipt[];
}

/**
 * Fetch receipts (orders) from Etsy API within a date range with pagination
 */
async function fetchEtsyReceipts(
  storeId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<EtsyReceipt[]> {
  try {
    // Convert dates to Unix timestamps
    const minCreated = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
    const maxCreated = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);
    
    const allReceipts: EtsyReceipt[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit
    
    while (hasMore && pageCount < MAX_PAGES) {
      const response = await axios.get<EtsyReceiptsResponse>(
        `https://api.etsy.com/v3/application/shops/${storeId}/receipts`,
        {
          headers: {
            "x-api-key": process.env.ETSY_CLIENT_ID!,
            "Authorization": `Bearer ${accessToken}`,
          },
          params: {
            min_created: minCreated,
            max_created: maxCreated,
            limit,
            offset,
          },
        }
      );
      
      const receipts = response.data.results || [];
      allReceipts.push(...receipts);
      pageCount++;
      
      // Etsy uses offset pagination
      // If we got fewer results than the limit, we're done
      if (receipts.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
      
      // Also check total count from response
      if (response.data.count !== undefined && allReceipts.length >= response.data.count) {
        hasMore = false;
      }
    }
    
    if (pageCount >= MAX_PAGES) {
      console.warn(`Etsy pagination reached MAX_PAGES (${MAX_PAGES}), results may be incomplete`);
    }
    
    console.log(`Fetched ${allReceipts.length} Etsy receipts across ${pageCount} pages`);
    return allReceipts;
  } catch (error: any) {
    console.error("Error fetching Etsy receipts:", error.message);
    return [];
  }
}

/**
 * Calculate revenue metrics from receipts
 */
function calculateRevenueMetrics(receipts: EtsyReceipt[]) {
  const totalRevenue = receipts.reduce((sum, receipt) => {
    const amount = receipt.grandtotal.amount / receipt.grandtotal.divisor;
    return sum + amount;
  }, 0);
  
  const totalOrders = receipts.length;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Count unique buyers in the selected period
  // Note: This is an approximation. True "new customers" would require
  // querying all historical receipts for each buyer to check if this
  // is their first purchase ever. Etsy API doesn't expose a simple
  // "is_first_time_buyer" field, so we use unique buyers as a proxy.
  const uniqueBuyers = new Set(receipts.map(r => r.buyer_user_id));
  const newCustomers = uniqueBuyers.size;
  
  return {
    revenue: totalRevenue,
    orders: totalOrders,
    aov,
    newCustomers,
  };
}

/**
 * Group receipts by date and calculate daily metrics
 */
function groupReceiptsByDate(receipts: EtsyReceipt[], dates: string[]) {
  const receiptsByDate = new Map<string, EtsyReceipt[]>();
  
  // Initialize all dates with empty arrays
  dates.forEach(date => receiptsByDate.set(date, []));
  
  // Group receipts by date
  receipts.forEach(receipt => {
    const receiptDate = new Date(receipt.create_timestamp * 1000)
      .toISOString()
      .slice(0, 10);
    if (receiptsByDate.has(receiptDate)) {
      receiptsByDate.get(receiptDate)!.push(receipt);
    }
  });
  
  return receiptsByDate;
}

async function buildOverview(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
  // Fetch post metrics
  const postResult = await db
    .select({
      posts: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} IN ('scheduled', 'published', 'failed'))`,
      published: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'published')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${posts.status} = 'failed')`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        sql`${posts.platforms} @> '["etsy"]'::jsonb`,
        gte(sql`DATE(${posts.createdAt})`, from),
        lte(sql`DATE(${posts.createdAt})`, to)
      )
    );

  const stats = postResult[0];
  
  // Generate date series for charts
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  // Try to fetch real Etsy data
  let revenueMetrics = {
    revenue: 0,
    orders: 0,
    aov: 0,
    newCustomers: 0,
  };
  
  let revenueSeries: { date: string; value: number }[] = dates.map(date => ({ date, value: 0 }));
  let ordersSeries: { date: string; value: number }[] = dates.map(date => ({ date, value: 0 }));
  
  try {
    // Get Etsy connection
    const [connection] = await db
      .select()
      .from(ecommerceConnections)
      .where(
        and(
          eq(ecommerceConnections.userId, userId),
          eq(ecommerceConnections.platform, "etsy")
        )
      )
      .limit(1);
    
    if (connection && connection.storeId) {
      // Decrypt access token
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Fetch receipts from Etsy
      const receipts = await fetchEtsyReceipts(
        connection.storeId,
        accessToken,
        from,
        to
      );
      
      // Calculate overall metrics
      revenueMetrics = calculateRevenueMetrics(receipts);
      
      // Calculate daily metrics
      const receiptsByDate = groupReceiptsByDate(receipts, dates);
      
      revenueSeries = dates.map(date => {
        const dayReceipts = receiptsByDate.get(date) || [];
        const dayRevenue = dayReceipts.reduce((sum, receipt) => {
          const amount = receipt.grandtotal.amount / receipt.grandtotal.divisor;
          return sum + amount;
        }, 0);
        return { date, value: dayRevenue };
      });
      
      ordersSeries = dates.map(date => {
        const dayReceipts = receiptsByDate.get(date) || [];
        return { date, value: dayReceipts.length };
      });
    }
  } catch (error: any) {
    console.error("Error fetching Etsy revenue data:", error.message);
    // Continue with placeholder data on error
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
      revenue: revenueMetrics.revenue,
      orders: revenueMetrics.orders,
      aov: revenueMetrics.aov,
      newCustomers: revenueMetrics.newCustomers,
      repeatRate: 0
    },
    series: [
      { id: "posts", label: "Posts", points: dates.map(date => ({ date, value: 0 })) },
      { id: "published", label: "Published", points: dates.map(date => ({ date, value: 0 })) },
      { id: "revenue", label: "Revenue", points: revenueSeries },
      { id: "orders", label: "Orders", points: ordersSeries }
    ]
  };
}

export const etsyAnalyticsRouter = Router();
etsyAnalyticsRouter.use(requireAuth);

etsyAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
  try {
    if (process.env.FEATURE_PER_PLATFORM_ANALYTICS !== "true") {
      return res.status(404).json({ error: "Feature not enabled" });
    }
    
    const userId = req.userId!;
    const { from, to } = req.query as { from?: string; to?: string };
    
    const today = new Date();
    const toDate = to ?? today.toISOString().slice(0, 10);
    const fromDate = from ?? (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return d.toISOString().slice(0, 10);
    })();
    
    const data = await buildOverview(userId, fromDate, toDate);
    res.json(data);
  } catch (error: any) {
    console.error("Etsy analytics error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default etsyAnalyticsRouter;
