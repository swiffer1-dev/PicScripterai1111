import type { ToneData } from "./types";

interface TonePerformanceCardProps {
  tones: ToneData[];
  isLoading: boolean;
}

export function TonePerformanceCard({ tones, isLoading }: TonePerformanceCardProps) {
  const sortedTones = (tones ?? []).sort((a, b) => b.avgEngagement - a.avgEngagement);
  const maxEngagement = sortedTones.length > 0 
    ? Math.max(...sortedTones.map(t => t.avgEngagement)) 
    : 1;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg p-6 hover:shadow-xl hover:border-purple-500/60 hover:-translate-y-[1px] transition-all duration-200">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white">Tone Performance</h3>
        <p className="text-sm text-slate-400 mt-1">
          Average engagement per post by tone
        </p>
      </div>

      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-sm text-slate-400">Loading...</div>
        </div>
      ) : sortedTones.length > 0 ? (
        <div className="space-y-4" data-testid="section-tone-performance">
          {sortedTones.map((tone, index) => (
            <div
              key={tone.tone}
              className="flex items-center justify-between"
              data-testid={`tone-${index}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-white capitalize">
                    {tone.tone}
                  </span>
                  <span className="text-xs text-slate-500">
                    {tone.count} post{tone.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((tone.avgEngagement / maxEngagement) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="ml-4 text-right">
                <div className="text-lg font-semibold text-white">
                  {tone.avgEngagement.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">avg engagement</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
          <div className="text-slate-400 mb-2">No tone data yet</div>
          <div className="text-sm text-slate-500">
            Create posts with different tones to see what performs best.
          </div>
        </div>
      )}
    </div>
  );
}
