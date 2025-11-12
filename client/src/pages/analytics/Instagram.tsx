import { useState, useEffect, useMemo } from "react";
import type { AnalyticsOverview } from "../../../../shared/analytics";
import { getInstagramOverview } from "@/services/instagramAnalytics";
import { Header, Kpis, TwoCharts } from "@/components/analytics/shared";

function useRange(p: "7d" | "30d" | "90d" = "7d") {
  const n = p === "30d" ? 30 : p === "90d" ? 90 : 7;
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const s = new Date(now);
  s.setDate(s.getDate() - (n - 1));
  const from = s.toISOString().slice(0, 10);
  return { from, to, preset: p };
}

export default function InstagramAnalytics() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("7d");
  const { from, to } = useRange(preset);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    getInstagramOverview({ from, to })
      .then(d => { if (!off) setData(d); })
      .catch(err => { if (!off) setError(err.message); })
      .finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [from, to]);

  const posts = useMemo(() => data?.series.find(s => s.id === "posts")?.points ?? [], [data]);
  const publ = useMemo(() => data?.series.find(s => s.id === "published")?.points ?? [], [data]);
  const likes = useMemo(() => data?.series.find(s => s.id === "likes")?.points ?? [], [data]);
  const comm = useMemo(() => data?.series.find(s => s.id === "comments")?.points ?? [], [data]);

  const barData = useMemo(() => {
    const m = new Map<string, any>();
    posts.forEach(p => m.set(p.date, { date: p.date, posts: p.value, published: 0 }));
    publ.forEach(p => m.set(p.date, { ...(m.get(p.date) || { date: p.date, posts: 0 }), published: p.value }));
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [posts, publ]);

  const lineData = useMemo(() => {
    const keys = new Set<string>([...likes.map(d => d.date), ...comm.map(d => d.date)]);
    const dates = Array.from(keys).sort();
    return dates.map(date => ({
      date,
      likes: likes.find(x => x.date === date)?.value ?? 0,
      comments: comm.find(x => x.date === date)?.value ?? 0
    }));
  }, [likes, comm]);

  return (
    <div className="space-y-6 p-6">
      <Header title="Instagram Analytics" preset={preset} setPreset={setPreset} />
      
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          Error: {error}
        </div>
      )}

      <Kpis
        k={data?.kpis}
        map={[
          ["Posts", "posts"],
          ["Published", "published"],
          ["Failed", "failed"],
          ["Likes", "likes"],
          ["Comments", "replies"]
        ]}
        loading={loading}
      />

      <TwoCharts
        barData={barData}
        lineData={lineData}
        lineKeys={[
          ["likes", "#60a5fa"],
          ["comments", "#f59e0b"]
        ]}
        loading={loading}
      />
    </div>
  );
}
