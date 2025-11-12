import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";
import type { AnalyticsOverview } from "../../../../shared/analytics";
import { getShopifyOverview } from "@/services/shopifyAnalytics";
import { Header, KpisMoney } from "@/components/analytics/shared";

function useRange(p: "7d" | "30d" | "90d" = "7d") {
  const n = p === "30d" ? 30 : p === "90d" ? 90 : 7;
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const s = new Date(now);
  s.setDate(s.getDate() - (n - 1));
  const from = s.toISOString().slice(0, 10);
  return { from, to, preset: p };
}

export default function ShopifyAnalytics() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("7d");
  const { from, to } = useRange(preset);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    getShopifyOverview({ from, to })
      .then(d => { if (!off) setData(d); })
      .catch(err => { if (!off) setError(err.message); })
      .finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [from, to]);

  const revenue = useMemo(() => data?.series.find(s => s.id === "revenue_cents" || s.id === "revenue")?.points ?? [], [data]);
  const orders = useMemo(() => data?.series.find(s => s.id === "orders")?.points ?? [], [data]);

  return (
    <div className="space-y-6 p-6">
      <Header title="Shopify Analytics" preset={preset} setPreset={setPreset} />

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          Error: {error}
        </div>
      )}

      <KpisMoney k={data?.kpis} loading={loading} />

      <Card className="p-4">
        <div className="font-medium mb-2">Revenue (cumulative)</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : revenue.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No revenue data available</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <AreaChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Revenue"
                  stroke="#60a5fa"
                  fill="#60a5fa22"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-medium mb-2">Orders</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No order data available</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart data={orders}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Orders"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
