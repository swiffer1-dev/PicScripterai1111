import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EngagementDataPoint } from "./types";

interface InsightsEngagementChartProps {
  data: EngagementDataPoint[];
  isLoading: boolean;
}

export function InsightsEngagementChart({ data, isLoading }: InsightsEngagementChartProps) {
  return (
    <div className="mt-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg p-6" data-testid="card-engagement-chart">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white" data-testid="heading-engagement-title">Engagement Over Time</h2>
        <p className="text-sm text-slate-400 mt-1" data-testid="text-engagement-subtitle">
          Shows likes, replies, reposts, and quotes for posts created in PicScripter.
        </p>
      </div>

      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center" data-testid="loading-engagement-chart">
          <div className="text-sm text-slate-400">Loading...</div>
        </div>
      ) : data.length > 0 ? (
        <div className="h-[400px]" data-testid="chart-engagement-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReposts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                stroke="#475569"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                stroke="#475569"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Legend
                wrapperStyle={{ color: '#cbd5e1' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="likes"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLikes)"
                name="Likes"
              />
              <Area
                type="monotone"
                dataKey="replies"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReplies)"
                name="Replies"
              />
              <Area
                type="monotone"
                dataKey="reposts"
                stroke="#a855f7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReposts)"
                name="Reposts"
              />
              <Area
                type="monotone"
                dataKey="quotes"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorQuotes)"
                name="Quotes"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center text-center px-4" data-testid="empty-engagement-state">
          <div className="text-slate-400 mb-2">No engagement data available yet</div>
          <div className="text-sm text-slate-500">
            Publish posts to Twitter/X to start tracking engagement metrics
          </div>
        </div>
      )}
    </div>
  );
}
