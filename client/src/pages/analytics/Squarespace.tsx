import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

export default function SquarespaceAnalytics() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("7d");
  const { from, to } = useRange(preset);

  const { data, isLoading, error } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/analytics/squarespace/overview', { from, to }],
  });

  const revenue = useMemo(() => data?.series.find(s => s.id === "revenue_cents" || s.id === "revenue")?.points ?? [], [data]);
  const orders = useMemo(() => data?.series.find(s => s.id === "orders")?.points ?? [], [data]);

  return (
    <div className="space-y-6 p-6" data-testid="page-squarespace-analytics">
      <Header title="Squarespace Analytics" preset={preset} setPreset={setPreset} />

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive" data-testid="error-message">
          Error: {(error as Error).message}
        </div>
      )}

      <KpisMoney k={data?.kpis} loading={isLoading} />

      <Card className="p-4" data-testid="card-revenue">
        <div className="font-medium mb-2">Revenue (cumulative)</div>
        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center" data-testid="loading-revenue">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : revenue.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center" data-testid="empty-revenue">
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

      <Card className="p-4" data-testid="card-orders">
        <div className="font-medium mb-2">Orders</div>
        {isLoading ? (
          <div className="h-[280px] flex items-center justify-center" data-testid="loading-orders">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center" data-testid="empty-orders">
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
