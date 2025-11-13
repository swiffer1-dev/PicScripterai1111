import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, TrendingUp, MessageCircle, Repeat2, Quote, Clock } from "lucide-react";
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
  Bar,
} from "recharts";
import insightsService, {
  type InsightsSummary,
  type EngagementDataPoint,
  type TonePerformance,
  type BestTimesData,
} from "@/services/insights";
import { cn } from "@/lib/utils";

const ranges = [7, 30, 90] as const;
type Range = typeof ranges[number];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InsightsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [range, setRange] = useState<Range>(7);

  // Fetch data using TanStack Query
  const { data: summary, isLoading: summaryLoading } = useQuery<InsightsSummary>({
    queryKey: ["/api/insights/summary", range],
    queryFn: () => insightsService.getSummary(range),
  });

  const { data: engagement, isLoading: engagementLoading } = useQuery<EngagementDataPoint[]>({
    queryKey: ["/api/insights/engagement", range],
    queryFn: () => insightsService.getEngagement(range),
  });

  const { data: tones, isLoading: tonesLoading } = useQuery<TonePerformance[]>({
    queryKey: ["/api/insights/tones", range],
    queryFn: () => insightsService.getTones(range),
  });

  const { data: bestTimes, isLoading: bestTimesLoading } = useQuery<BestTimesData>({
    queryKey: ["/api/insights/best-times", 30],
    queryFn: () => insightsService.getBestTimes(30),
  });

  const kpis = summary?.kpis;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-background border-b border-border p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">PicScripter Insights</h1>
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight">PicScripter Insights</h1>
              <p className="text-muted-foreground mt-1.5">
                Track your content performance and optimize your posting strategy
              </p>
            </div>
            <div className="inline-flex gap-2 bg-muted/50 p-1 rounded-lg">
              {ranges.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={r === range ? "default" : "ghost"}
                  className={cn("rounded-md", r === range && "shadow")}
                  onClick={() => setRange(r)}
                  data-testid={`button-range-${r}`}
                >
                  {r} Days
                </Button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <KpiCard
              title="Posts Created"
              value={kpis?.postsCreated ?? 0}
              loading={summaryLoading}
              icon={<TrendingUp className="h-4 w-4" />}
              data-testid="kpi-posts-created"
            />
            <KpiCard
              title="Published"
              value={kpis?.published ?? 0}
              loading={summaryLoading}
              icon={<TrendingUp className="h-4 w-4" />}
              data-testid="kpi-published"
            />
            <KpiCard
              title="Failed"
              value={kpis?.failed ?? 0}
              loading={summaryLoading}
              variant="destructive"
              icon={<TrendingUp className="h-4 w-4" />}
              data-testid="kpi-failed"
            />
            <KpiCard
              title="Avg Engagement"
              value={kpis?.avgEngagementPerPost ? kpis.avgEngagementPerPost.toFixed(1) : "0"}
              loading={summaryLoading}
              icon={<MessageCircle className="h-4 w-4" />}
              data-testid="kpi-avg-engagement"
            />
            <KpiCard
              title="Top Tone"
              value={kpis?.topTone ?? "None"}
              loading={summaryLoading}
              icon={<Quote className="h-4 w-4" />}
              data-testid="kpi-top-tone"
            />
          </div>

          {/* Engagement Over Time */}
          <Card className="mb-8 border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Engagement Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {engagementLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">Loading chart...</div>
                </div>
              ) : engagement && engagement.length > 0 ? (
                <div className="h-[300px]" data-testid="chart-engagement">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={engagement}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }} 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="likes" stroke="#60a5fa" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reposts" stroke="#a78bfa" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="replies" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="quotes" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">No engagement data available</div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Tone Performance */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Tone Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {tonesLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                ) : tones && tones.length > 0 ? (
                  <div className="h-[300px]" data-testid="chart-tones">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tones}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="tone" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} name="Posts" />
                        <Bar dataKey="avgEngagement" fill="#34d399" radius={[4, 4, 0, 0]} name="Avg Engagement" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">No tone data available</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Best Times to Post */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Best Times to Post
                </CardTitle>
                <p className="text-sm text-muted-foreground">Based on average engagement</p>
              </CardHeader>
              <CardContent>
                {bestTimesLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                ) : bestTimes && bestTimes.buckets.length > 0 ? (
                  <div className="space-y-3" data-testid="heatmap-best-times">
                    {/* Simple list view of top times */}
                    {bestTimes.buckets
                      .sort((a, b) => b.avgEngagement - a.avgEngagement)
                      .slice(0, 7)
                      .map((bucket, idx) => (
                        <div
                          key={`${bucket.weekday}-${bucket.hour}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                          data-testid={`best-time-${idx}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-medium">
                                {WEEKDAY_LABELS[bucket.weekday]} at {bucket.hour}:00
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {bucket.posts} post{bucket.posts !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary">
                              {bucket.avgEngagement.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">avg engagement</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">
                      Not enough data. Publish more posts to see best times.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  title,
  value,
  loading,
  icon,
  variant = "default",
  ...props
}: {
  title: string;
  value: number | string;
  loading: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  [key: string]: any;
}) {
  return (
    <Card className="border-border shadow-sm" {...props}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-2xl font-bold text-muted-foreground">-</div>
        ) : (
          <div className={cn("text-3xl font-bold", variant === "destructive" && "text-destructive")}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
