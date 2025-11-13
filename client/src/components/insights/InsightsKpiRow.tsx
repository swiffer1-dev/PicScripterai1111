import { TrendingUp, CheckCircle, XCircle, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiMetrics } from "./types";

interface InsightsKpiRowProps {
  metrics: KpiMetrics;
  rangeLabel: string;
}

export function InsightsKpiRow({ metrics, rangeLabel }: InsightsKpiRowProps) {
  const kpis = [
    {
      label: "Posts Created",
      value: metrics.totalPosts,
      icon: TrendingUp,
      color: "text-blue-400",
      testId: "text-total-posts",
    },
    {
      label: "Published",
      value: metrics.publishedPosts,
      icon: CheckCircle,
      color: "text-green-400",
      testId: "text-published-posts",
    },
    {
      label: "Failed",
      value: metrics.failedPosts,
      icon: XCircle,
      color: metrics.failedPosts > 0 ? "text-red-400" : "text-slate-400",
      testId: "text-failed-posts",
    },
    {
      label: "Avg Engagement",
      value: (metrics.avgEngagement ?? 0).toFixed(1),
      icon: Heart,
      color: "text-purple-400",
      testId: "text-avg-engagement",
    },
    {
      label: "Top Tone",
      value: metrics.topTone || "None",
      icon: Sparkles,
      color: "text-amber-400",
      testId: "text-top-tone",
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg p-4 hover:shadow-xl hover:border-purple-500/60 hover:-translate-y-[1px] transition-all duration-200"
          data-testid={`card-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {kpi.label}
            </span>
            <kpi.icon className={cn("h-4 w-4", kpi.color)} />
          </div>
          <div className="text-3xl font-semibold text-white mb-1" data-testid={kpi.testId}>
            {kpi.value}
          </div>
          <div className="text-xs text-slate-500">
            Last {rangeLabel}
          </div>
        </div>
      ))}
    </div>
  );
}
