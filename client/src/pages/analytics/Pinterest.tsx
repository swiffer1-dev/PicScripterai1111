import { useState, useEffect, useMemo } from "react";
import type { AnalyticsOverview } from "../../../../shared/analytics";
import { getPinterestOverview } from "@/services/pinterestAnalytics";
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

export default function PinterestAnalytics() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d">("7d");
  const { from, to } = useRange(preset);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    getPinterestOverview({ from, to })
      .then(d => { if (!off) setData(d); })
      .catch(err => { if (!off) setError(err.message); })
      .finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, [from, to]);

  const posts = useMemo(() => data?.series.find(s => s.id === "posts")?.points ?? [], [data]);
  const publ = useMemo(() => data?.series.find(s => s.id === "published")?.points ?? [], [data]);
  const saves = useMemo(() => data?.series.find(s => s.id === "saves")?.points ?? [], [data]);
  const clicks = useMemo(() => data?.series.find(s => s.id === "outbound_clicks")?.points ?? [], [data]);

  const barData = useMemo(() => {
    const m = new Map<string, any>();
    posts.forEach(p => m.set(p.date, { date: p.date, posts: p.value, published: 0 }));
    publ.forEach(p => m.set(p.date, { ...(m.get(p.date) || { date: p.date, posts: 0 }), published: p.value }));
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [posts, publ]);

  const lineData = useMemo(() => {
    const keys = new Set<string>([...saves.map(d => d.date), ...clicks.map(d => d.date)]);
    const dates = Array.from(keys).sort();
    return dates.map(date => ({
      date,
      saves: saves.find(x => x.date === date)?.value ?? 0,
      clicks: clicks.find(x => x.date === date)?.value ?? 0
    }));
  }, [saves, clicks]);

  return (
    <div className="space-y-6 p-6">
      <Header title="Pinterest Analytics" preset={preset} setPreset={setPreset} />

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          Error: {error}
        </div>
      )}

      <Kpis
        k={data?.kpis}
        map={[
          ["Pins", "posts"],
          ["Published", "published"],
          ["Failed", "failed"],
          ["Saves", "likes"],
          ["Outbound Clicks", "reposts"]
        ]}
        loading={loading}
      />

      <TwoCharts
        barData={barData}
        lineData={lineData}
        lineKeys={[
          ["saves", "#60a5fa"],
          ["clicks", "#34d399"]
        ]}
        loading={loading}
      />
    </div>
  );
}
