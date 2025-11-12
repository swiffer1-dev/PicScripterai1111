import * as React from "react";
import {
  getSummary,
  getEngagement,
  getTopTones,
  toSharedOverview,
  type EngagementPoint,
  type SummaryKpis,
} from "@/services/analytics";
import type { AnalyticsOverview } from "@shared/analytics";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const ranges = [7, 30] as const;
type Range = typeof ranges[number];

const USE_SHARED = import.meta.env.VITE_USE_SHARED_ANALYTICS === "1";

type NormalizedData = {
  connectedPlatforms: number;
  postsScheduled: number;
  postsPublished: number;
  publishFailed: number;
  chartData: { date: string; likes: number; reposts: number; replies: number; quotes: number }[];
  tones: { tone: string; count: number }[] | null;
};

function useAnalytics(range: Range) {
  const [data, setData] = React.useState<NormalizedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      getSummary(range),
      getEngagement(range),
      getTopTones(range),
    ]).then((results) => {
      if (!mounted) return;

      const [k, s, t] = results;
      
      if (k.status === "rejected" || s.status === "rejected") {
        setError("Failed to load analytics data");
        setLoading(false);
        return;
      }

      const summary = k.value;
      const engagement = s.value;
      const tones = t.status === "fulfilled" ? t.value : null;

      if (USE_SHARED) {
        const shared: AnalyticsOverview = toSharedOverview(summary, engagement);
        
        const chartData = shared.series[0]?.points.map((point, idx) => ({
          date: point.date,
          likes: shared.series.find(s => s.id === "likes")?.points[idx]?.value ?? 0,
          reposts: shared.series.find(s => s.id === "reposts")?.points[idx]?.value ?? 0,
          replies: shared.series.find(s => s.id === "replies")?.points[idx]?.value ?? 0,
          quotes: shared.series.find(s => s.id === "quotes")?.points[idx]?.value ?? 0,
        })) ?? [];

        setData({
          connectedPlatforms: summary.connectedPlatforms,
          postsScheduled: shared.kpis.posts ?? 0,
          postsPublished: shared.kpis.published ?? 0,
          publishFailed: shared.kpis.failed ?? 0,
          chartData,
          tones,
        });
      } else {
        setData({
          connectedPlatforms: summary.connectedPlatforms,
          postsScheduled: summary.postsScheduled,
          postsPublished: summary.postsPublished,
          publishFailed: summary.publishFailed,
          chartData: engagement,
          tones,
        });
      }

      setLoading(false);
    });

    return () => { mounted = false; };
  }, [range]);

  return { data, error, loading };
}

function Kpi({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-b from-white/3 to-white/0 dark:from-white/5 p-4 border border-white/10", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function PerformanceOverview() {
  const [range, setRange] = React.useState<Range>(7);
  const { data, error, loading } = useAnalytics(range);

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-b from-zinc-900/50 to-zinc-900/20">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle className="text-lg">Performance Overview</CardTitle>
        <div className="inline-flex gap-2">
          {ranges.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === range ? "default" : "secondary"}
              className={cn("rounded-full", r === range && "shadow")}
              onClick={() => setRange(r)}
            >
              Last {r} Days
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading ? (
            <>
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
            </>
          ) : (
            <>
              <Kpi label="Connected Platforms" value={data?.connectedPlatforms ?? 0} />
              <Kpi label="Posts Scheduled" value={data?.postsScheduled ?? 0} />
              <Kpi label="Posts Published" value={data?.postsPublished ?? 0} />
              <Kpi label="Publish Failed" value={data?.publishFailed ?? 0} />
            </>
          )}
        </div>

        {/* Chart */}
        <div className="h-64 rounded-2xl border border-white/10 bg-black/20 p-2">
          {error && (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!error && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReposts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gQuotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(24,24,27,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                  labelStyle={{ color: "white" }}
                />
                <Legend />
                <Area type="monotone" dataKey="likes" stroke="#60a5fa" fill="url(#gLikes)" strokeWidth={2} />
                <Area type="monotone" dataKey="reposts" stroke="#34d399" fill="url(#gReposts)" strokeWidth={2} />
                <Area type="monotone" dataKey="replies" stroke="#f59e0b" fill="url(#gReplies)" strokeWidth={2} />
                <Area type="monotone" dataKey="quotes" stroke="#a78bfa" fill="url(#gQuotes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top tones (optional) */}
        {data?.tones && data.tones.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Top Performing Tones</div>
            <div className="flex flex-wrap gap-2">
              {data.tones.map((t) => (
                <span
                  key={t.tone}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                  title={`${t.count} posts`}
                >
                  {t.tone} · {t.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
