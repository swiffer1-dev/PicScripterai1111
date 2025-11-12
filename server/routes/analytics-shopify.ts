import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/cookie-auth";
import type { AnalyticsOverview } from "../../shared/analytics";

async function fetchShopifyDaily(userId: string, from: string, to: string) {
  return [];
}

function toSeries(rows: any[], key: string, label: string) {
  return {
    id: key,
    label,
    points: rows.map((r: any) => ({ date: r.date, value: Number(r[key]) || 0 }))
  };
}

async function buildOverview(userId: string, from: string, to: string): Promise<AnalyticsOverview> {
  const rows = await fetchShopifyDaily(userId, from, to);
  const sum = (k: string) => rows.reduce((a, r) => a + (Number((r as any)[k]) || 0), 0);
  const revenue = sum("revenue_cents");
  const orders = sum("orders");
  
  const kpis = {
    revenue,
    orders,
    aov: Math.round(revenue / Math.max(1, orders)),
    newCustomers: sum("new_customers"),
    repeatRate: (() => {
      const repeat = sum("repeat_customers");
      return orders ? repeat / orders : 0;
    })(),
  };
  
  const series = [
    toSeries(rows, "revenue_cents", "Revenue"),
    toSeries(rows, "orders", "Orders"),
  ];
  
  return { platform: "shopify", kpis, series };
}

export const shopifyAnalyticsRouter = Router();
shopifyAnalyticsRouter.use(requireAuth);

shopifyAnalyticsRouter.get("/overview", async (req: AuthRequest, res) => {
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

export default shopifyAnalyticsRouter;
