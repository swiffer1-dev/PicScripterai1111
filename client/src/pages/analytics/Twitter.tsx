import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  BarChart, 
  Bar 
} from "recharts";
import { getTwitterOverview } from "@/services/twitterAnalytics";
import type { AnalyticsOverview } from "../../../../shared/analytics";

function useRange(preset: "7d" | "30d" | "90d" = "7d") {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const n = preset === "30d" ? 30 : preset === "90d" ? 90 : 7;
  const start = new Date(now);
  start.setDate(start.getDate() - (n - 1));
  const from = start.toISOString().slice(0, 10);
  return { preset, from, to };
}

export default function TwitterAnalyticsPage() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("7d");
  const { from, to } = useRange(preset);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    getTwitterOverview({ from, to })
      .then((d) => {
        if (!off) setData(d);
      })
      .catch((err) => {
        if (!off) setError(err.message);
      })
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [from, to]);

  const postsSeries = useMemo(() => data?.series.find(s => s.id === "posts")?.points ?? [], [data]);
  const publishedSeries = useMemo(() => data?.series.find(s => s.id === "published")?.points ?? [], [data]);
  const likesSeries = useMemo(() => data?.series.find(s => s.id === "likes")?.points ?? [], [data]);
  const repliesSeries = useMemo(() => data?.series.find(s => s.id === "replies")?.points ?? [], [data]);
  const repostsSeries = useMemo(() => data?.series.find(s => s.id === "reposts")?.points ?? [], [data]);
  const quotesSeries = useMemo(() => data?.series.find(s => s.id === "quotes")?.points ?? [], [data]);

  const barData = useMemo(() => {
    const byDate = new Map<string, any>();
    for (const p of postsSeries) byDate.set(p.date, { date: p.date, posts: p.value, published: 0 });
    for (const p of publishedSeries) {
      byDate.set(p.date, { ...(byDate.get(p.date) ?? { date: p.date, posts: 0 }), published: p.value });
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [postsSeries, publishedSeries]);

  const lineData = useMemo(() => {
    const keys = new Set<string>([
      ...likesSeries.map(d => d.date),
      ...repliesSeries.map(d => d.date),
      ...repostsSeries.map(d => d.date),
      ...quotesSeries.map(d => d.date),
    ]);
    const dates = Array.from(keys).sort();
    return dates.map(date => ({
      date,
      likes: likesSeries.find(x => x.date === date)?.value ?? 0,
      replies: repliesSeries.find(x => x.date === date)?.value ?? 0,
      reposts: repostsSeries.find(x => x.date === date)?.value ?? 0,
      quotes: quotesSeries.find(x => x.date === date)?.value ?? 0,
    }));
  }, [likesSeries, repliesSeries, repostsSeries, quotesSeries]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Twitter Analytics</h1>
        <div className="inline-flex rounded-xl border p-1 gap-1">
          {(["7d", "30d", "90d"] as const).map(p => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "secondary"}
              onClick={() => setPreset(p)}
              className="rounded-lg"
            >
              {p.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/30">
          <div className="text-sm text-destructive">Error: {error}</div>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
        <Kpi title="Posts" value={data?.kpis.posts} loading={loading} />
        <Kpi title="Published" value={data?.kpis.published} loading={loading} />
        <Kpi title="Failed" value={data?.kpis.failed} loading={loading} />
        <Kpi title="Likes" value={data?.kpis.likes} loading={loading} />
        <Kpi title="Replies" value={data?.kpis.replies} loading={loading} />
        <Kpi title="Reposts" value={data?.kpis.reposts} loading={loading} />
        <Kpi title="Quotes" value={data?.kpis.quotes} loading={loading} />
      </div>

      {/* Posts vs Published */}
      <Card className="p-4">
        <div className="font-medium mb-2">Posts vs Published</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="posts" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="published" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Engagement over time */}
      <Card className="p-4">
        <div className="font-medium mb-2">Engagement (Likes / Replies / Reposts / Quotes)</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="likes" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="replies" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reposts" stroke="#a78bfa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="quotes" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ title, value, loading }: { title: string; value: number | undefined; loading: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse bg-white/5 rounded mt-1" />
      ) : (
        <div className="text-2xl font-semibold">{(value ?? 0).toLocaleString()}</div>
      )}
    </Card>
  );
}
