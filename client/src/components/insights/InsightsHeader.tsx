import { cn } from "@/lib/utils";

interface InsightsHeaderProps {
  range: 7 | 30 | 90;
  onRangeChange: (range: 7 | 30 | 90) => void;
}

export function InsightsHeader({ range, onRangeChange }: InsightsHeaderProps) {
  const ranges: Array<7 | 30 | 90> = [7, 30, 90];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8" data-testid="section-insights-header">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white" data-testid="heading-insights-title">
          PicScripter Insights
        </h1>
        <p className="text-slate-400 mt-1.5 text-sm" data-testid="text-insights-subtitle">
          Track your content performance and optimize your posting strategy
        </p>
      </div>
      
      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-full border border-slate-700" data-testid="control-range-selector">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-full transition-all duration-200",
              range === r
                ? "bg-purple-500 text-white shadow-lg"
                : "bg-transparent text-slate-300 hover:text-white"
            )}
            data-testid={`button-range-${r}`}
          >
            {r} Days
          </button>
        ))}
      </div>
    </div>
  );
}
