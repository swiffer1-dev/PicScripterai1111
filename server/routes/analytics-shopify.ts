import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";
import { db } from "../db";
import { posts, ecommerceConnections } from "../../shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { decryptToken } from "../utils/encryption";
import axios from "axios";

interface ShopifyOrder {
  id: string;
  created_at: string;
  total_price: string;
  current_total_price: string;
  customer: {
    id: string;
    orders_count?: number;
  } | null;
}

interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

/**
 * Fetch orders from Shopify API within a date range with pagination
 */
async function fetchShopifyOrders(
  storeUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<ShopifyOrder[]> {
  try {
    const shopDomain = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Add time to dates for Shopify API
    const createdAtMin = `${startDate}T00:00:00Z`;
    const createdAtMax = `${endDate}T23:59:59Z`;
    
    const allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit to prevent infinite loops
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      const params: any = {
        status: "any",
        created_at_min: createdAtMin,
        created_at_max: createdAtMax,
        limit: 250, // Max per request
        // Note: Shopify fields parameter only accepts top-level fields
        // The customer object will include id and orders_count automatically
        fields: "id,created_at,total_price,current_total_price,customer",
      };
      
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      
      const response = await axios.get<ShopifyOrdersResponse>(
        `https://${shopDomain}/admin/api/2025-01/orders.json`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
          },
          params,
        }
      );
      
      const orders = response.data.orders || [];
      allOrders.push(...orders);
      pageCount++;
      
      // Check for pagination in Link header
      const linkHeader = response.headers.link || response.headers.Link;
      if (linkHeader && typeof linkHeader === 'string') {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
      
      // If we got fewer orders than the limit, we're done
      if (orders.length < 250) {
        hasNextPage = false;
      }
    }
    
    if (pageCount >= MAX_PAGES) {
      console.warn(`Shopify pagination reached MAX_PAGES (${MAX_PAGES}), results may be incomplete`);
    }
    
    console.log(`Fetched ${allOrders.length} Shopify orders across ${pageCount} pages`);
    return allOrders;
  } catch (error: any) {
    console.error("Error fetching Shopify orders:", error.message);
    // Return empty array on error to avoid breaking the entire analytics page
    return [];
  }
}

/**
 * Calculate revenue metrics from orders
 */
function calculateRevenueMetrics(orders: ShopifyOrder[]) {
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + parseFloat(order.current_total_price || order.total_price || "0");
  }, 0);
  
  const totalOrders = orders.length;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Count new customers (first-time buyers within this period)
  // orders_count === 1 means this is their first order ever
  const newCustomers = orders.filter(
    order => order.customer && order.customer.orders_count === 1
  ).length;
  
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
function groupOrdersByDate(orders: ShopifyOrder[], dates: string[]) {
  const ordersByDate = new Map<string, ShopifyOrder[]>();
  
  // Initialize all dates with empty arrays
  dates.forEach(date => ordersByDate.set(date, []));
  
  // Group orders by date
  orders.forEach(order => {
    const orderDate = order.created_at.slice(0, 10); // Extract YYYY-MM-DD
    if (ordersByDate.has(orderDate)) {
      ordersByDate.get(orderDate)!.push(order);
    }
  });
  
  return ordersByDate;
}

async function fetchShopifyDaily(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
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
        sql`${posts.platforms} @> '["shopify"]'::jsonb`,
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

  // Try to fetch real Shopify data
  let revenueMetrics = {
    revenue: 0,
    orders: 0,
    aov: 0,
    newCustomers: 0,
  };
  
  let revenueSeries: { date: string; value: number }[] = dates.map(date => ({ date, value: 0 }));
  let ordersSeries: { date: string; value: number }[] = dates.map(date => ({ date, value: 0 }));
  
  try {
    // Get Shopify connection
    const [connection] = await db
      .select()
      .from(ecommerceConnections)
      .where(
        and(
          eq(ecommerceConnections.userId, userId),
          eq(ecommerceConnections.platform, "shopify")
        )
      )
      .limit(1);
    
    if (connection && connection.storeUrl) {
      // Decrypt access token
      const accessToken = decryptToken(connection.accessTokenEnc);
      
      // Fetch orders from Shopify
      const orders = await fetchShopifyOrders(
        connection.storeUrl,
        accessToken,
        from,
        to
      );
      
      // Calculate overall metrics
      revenueMetrics = calculateRevenueMetrics(orders);
      
      // Calculate daily metrics
      const ordersByDate = groupOrdersByDate(orders, dates);
      
      revenueSeries = dates.map(date => {
        const dayOrders = ordersByDate.get(date) || [];
        const dayRevenue = dayOrders.reduce((sum, order) => {
          return sum + parseFloat(order.current_total_price || order.total_price || "0");
        }, 0);
        return { date, value: dayRevenue };
      });
      
      ordersSeries = dates.map(date => {
        const dayOrders = ordersByDate.get(date) || [];
        return { date, value: dayOrders.length };
      });
    }
  } catch (error: any) {
    console.error("Error fetching Shopify revenue data:", error.message);
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
      repeatRate: 0 // Would need historical customer data to calculate
    },
    series: [
      { id: "posts", label: "Posts", points: dates.map(date => ({ date, value: 0 })) },
      { id: "published", label: "Published", points: dates.map(date => ({ date, value: 0 })) },
      { id: "revenue", label: "Revenue", points: revenueSeries },
      { id: "orders", label: "Orders", points: ordersSeries }
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
    
    const userId = req.userId!;
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
