import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar
} from "recharts";
import ChartSkeleton from "./ChartSkeleton";

type Summary = {
  totals: { likes: number; reposts: number; replies: number; quotes: number };
  daily: Array<{ date: string; likes: number; reposts: number; replies: number; quotes: number }>;
};

const COLORS = {
  likes: "#60A5FA",
  reposts: "#34D399",
  replies: "#F59E0B",
  quotes: "#F472B6",
};

function formatNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export default function ModernEngagementChart() {
  const enabled = import.meta.env.VITE_UI_MODERN_CHART === "1";
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"area" | "bar">("area");
  const [active, setActive] = useState<Record<string, boolean>>({
    likes: true,
    reposts: true,
    replies: true,
    quotes: false,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/metrics/engagement/summary?days=${days}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch engagement data: ${res.statusText}`);
        }

        const json = await res.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load engagement data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const series = useMemo(
    () => Object.entries(active).filter(([_, on]) => on).map(([k]) => k),
    [active]
  );

  const toggle = (key: string) => setActive(s => ({ ...s, [key]: !s[key] }));

  if (!enabled) return null;

  return (
    <Card className="overflow-hidden border-zinc-700/40 bg-zinc-900/60" data-testid="card-modern-engagement-chart">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-zinc-100">Engagement (Last {days} Days)</CardTitle>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex rounded-xl bg-zinc-800/70 p-1 border border-zinc-700/40">
            {(["area", "bar"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  mode === m
                    ? "bg-zinc-700/60 text-white"
                    : "text-zinc-300 hover:text-white"
                }`}
                data-testid={`button-mode-${m}`}
              >
                {m === "area" ? "Smooth" : "Stacked"}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-zinc-800/70 p-1 border border-zinc-700/40">
            {[7, 30].map(n => (
              <button
                key={n}
                onClick={() => setDays(n as 7 | 30)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  days === n
                    ? "bg-zinc-700/60 text-white"
                    : "text-zinc-300 hover:text-white"
                }`}
                data-testid={`button-days-${n}`}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <div className="h-full" data-testid="skeleton-chart">
            <ChartSkeleton />
          </div>
        ) : error ? (
          <div
            className="h-full flex items-center justify-center text-red-400 text-sm"
            data-testid="text-error-state"
          >
            {error}
          </div>
        ) : !data || data.daily.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-zinc-400 text-sm"
            data-testid="text-empty-state"
          >
            No engagement yet — publish a post to see stats.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === "area" ? (
              <AreaChart data={data.daily}>
                <defs>
                  <linearGradient id="gLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.likes} stopOpacity={0.65} />
                    <stop offset="95%" stopColor={COLORS.likes} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gReposts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.reposts} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={COLORS.reposts} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.replies} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={COLORS.replies} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gQuotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.quotes} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={COLORS.quotes} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "#A1A1AA", fontSize: 12 }}
                  tickFormatter={formatNum}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0B0B0F",
                    border: "1px solid #27272A",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "#E4E4E7" }}
                  formatter={(v: any, n: any) => [v, n.toUpperCase()]}
                />
                {series.includes("likes") && (
                  <Area
                    type="monotone"
                    dataKey="likes"
                    stroke={COLORS.likes}
                    strokeWidth={2}
                    fill="url(#gLikes)"
                  />
                )}
                {series.includes("reposts") && (
                  <Area
                    type="monotone"
                    dataKey="reposts"
                    stroke={COLORS.reposts}
                    strokeWidth={2}
                    fill="url(#gReposts)"
                  />
                )}
                {series.includes("replies") && (
                  <Area
                    type="monotone"
                    dataKey="replies"
                    stroke={COLORS.replies}
                    strokeWidth={2}
                    fill="url(#gReplies)"
                  />
                )}
                {series.includes("quotes") && (
                  <Area
                    type="monotone"
                    dataKey="quotes"
                    stroke={COLORS.quotes}
                    strokeWidth={2}
                    fill="url(#gQuotes)"
                  />
                )}
                <Legend
                  formatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                  onClick={(e) => toggle((e as any).value)}
                  wrapperStyle={{ color: "#D4D4D8", cursor: "pointer" }}
                />
              </AreaChart>
            ) : (
              <BarChart data={data.daily}>
                <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "#A1A1AA", fontSize: 12 }}
                  tickFormatter={formatNum}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0B0B0F",
                    border: "1px solid #27272A",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "#E4E4E7" }}
                />
                {series.includes("likes") && (
                  <Bar dataKey="likes" stackId="a" fill={COLORS.likes} />
                )}
                {series.includes("reposts") && (
                  <Bar dataKey="reposts" stackId="a" fill={COLORS.reposts} />
                )}
                {series.includes("replies") && (
                  <Bar dataKey="replies" stackId="a" fill={COLORS.replies} />
                )}
                {series.includes("quotes") && <Bar dataKey="quotes" fill={COLORS.quotes} />}
                <Legend
                  formatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                  onClick={(e) => toggle((e as any).value)}
                  wrapperStyle={{ color: "#D4D4D8", cursor: "pointer" }}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
