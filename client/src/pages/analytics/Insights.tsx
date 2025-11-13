import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, TrendingUp, MessageCircle, Quote, FileText, Heart, Repeat2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import type { Post } from "@shared/schema";

const ranges = [7, 30, 90] as const;
type Range = typeof ranges[number];

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  youtube: "YouTube",
  facebook: "Facebook",
};

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

  const { data: posts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const kpis = summary?.kpis;

  // Get top posts by published status
  const topPosts = posts
    ?.filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5) ?? [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 p-4 flex items-center gap-3">
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {/* Header */}
          <div className="mb-8 lg:mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="hidden lg:block">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                PicScripter Insights
              </h1>
              <p className="text-muted-foreground mt-2 text-base">
                Track your content performance and optimize your posting strategy
              </p>
            </div>
            
            {/* Time Range Toggle */}
            <div className="inline-flex gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/50 shadow-sm">
              {ranges.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={r === range ? "default" : "ghost"}
                  className={cn(
                    "rounded-lg font-medium transition-all",
                    r === range && "shadow-md"
                  )}
                  onClick={() => setRange(r)}
                  data-testid={`button-range-${r}`}
                >
                  {r} Days
                </Button>
              ))}
            </div>
          </div>

          {/* KPI Overview Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mb-8 lg:mb-10">
            <KpiCard
              title="Posts Created"
              value={kpis?.postsCreated ?? 0}
              loading={summaryLoading}
              icon={<FileText className="h-4 w-4" />}
              gradient="from-blue-500/10 to-cyan-500/10"
              iconColor="text-blue-500"
              data-testid="kpi-posts-created"
            />
            <KpiCard
              title="Published"
              value={kpis?.published ?? 0}
              loading={summaryLoading}
              icon={<TrendingUp className="h-4 w-4" />}
              gradient="from-green-500/10 to-emerald-500/10"
              iconColor="text-green-500"
              data-testid="kpi-published"
            />
            <KpiCard
              title="Failed"
              value={kpis?.failed ?? 0}
              loading={summaryLoading}
              variant="destructive"
              icon={<MessageCircle className="h-4 w-4" />}
              gradient="from-red-500/10 to-rose-500/10"
              iconColor="text-red-500"
              data-testid="kpi-failed"
            />
            <KpiCard
              title="Avg Engagement"
              value={kpis?.avgEngagementPerPost ? kpis.avgEngagementPerPost.toFixed(1) : "0"}
              loading={summaryLoading}
              icon={<Heart className="h-4 w-4" />}
              gradient="from-purple-500/10 to-pink-500/10"
              iconColor="text-purple-500"
              data-testid="kpi-avg-engagement"
            />
            <KpiCard
              title="Top Tone"
              value={kpis?.topTone ?? "None"}
              loading={summaryLoading}
              icon={<Quote className="h-4 w-4" />}
              gradient="from-amber-500/10 to-orange-500/10"
              iconColor="text-amber-500"
              data-testid="kpi-top-tone"
            />
          </div>

          {/* Engagement Over Time Chart */}
          <Card className="mb-8 lg:mb-10 border-border/40 shadow-lg rounded-2xl hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl font-semibold">Engagement Over Time</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track how your audience interacts with your content
              </p>
            </CardHeader>
            <CardContent>
              {engagementLoading ? (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">Loading chart...</div>
                </div>
              ) : engagement && engagement.length > 0 ? (
                <div className="h-[350px]" data-testid="chart-engagement">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={engagement}>
                      <defs>
                        <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorReposts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }} 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="likes" stroke="#60a5fa" fill="url(#colorLikes)" strokeWidth={2} />
                      <Area type="monotone" dataKey="reposts" stroke="#a78bfa" fill="url(#colorReposts)" strokeWidth={2} />
                      <Area type="monotone" dataKey="replies" stroke="#f59e0b" fill="url(#colorReplies)" strokeWidth={2} />
                      <Area type="monotone" dataKey="quotes" stroke="#34d399" fill="url(#colorQuotes)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">No engagement data available</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two-Column Row: Tone Performance + Top Posts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-8 lg:mb-10">
            {/* Tone Performance */}
            <Card className="border-border/40 shadow-lg rounded-2xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold">Tone Performance</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Which writing styles perform best
                </p>
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
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="count" fill="#60a5fa" radius={[8, 8, 0, 0]} name="Posts" />
                        <Bar dataKey="avgEngagement" fill="#34d399" radius={[8, 8, 0, 0]} name="Avg Engagement" />
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

            {/* Top Posts */}
            <Card className="border-border/40 shadow-lg rounded-2xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold">Top Posts</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your most recent published content
                </p>
              </CardHeader>
              <CardContent>
                {topPosts.length > 0 ? (
                  <div className="space-y-3" data-testid="table-top-posts">
                    {topPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 hover:border-border/60 transition-all duration-200"
                        data-testid={`post-${post.id}`}
                      >
                        {/* Thumbnail */}
                        {post.mediaUrl || ((post as any).imageUrls && (post as any).imageUrls[0]) ? (
                          <img
                            src={post.mediaUrl || (post as any).imageUrls[0]}
                            alt="Post thumbnail"
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border/40"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0 border border-border/40">
                            <FileText className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}

                        {/* Caption & Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2 mb-1.5">
                            {post.caption || "No caption"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                              {platformLabels[post.platform] || post.platform}
                            </span>
                            <span>•</span>
                            <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <div className="text-sm text-muted-foreground">
                      No published posts yet. Create and publish your first post to see it here!
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Best Times to Post - Preserved from original */}
          <Card className="border-border/40 shadow-lg rounded-2xl hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl font-semibold">Best Times to Post</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Optimal posting times based on engagement patterns
              </p>
            </CardHeader>
            <CardContent>
              {bestTimesLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">Loading...</div>
                </div>
              ) : bestTimes && bestTimes.buckets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="section-best-times">
                  {bestTimes.buckets
                    .sort((a, b) => b.avgEngagement - a.avgEngagement)
                    .slice(0, 8)
                    .map((bucket, idx) => {
                      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                      return (
                        <div
                          key={`${bucket.weekday}-${bucket.hour}`}
                          className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/30 transition-colors"
                          data-testid={`best-time-${idx}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {weekdays[bucket.weekday]}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {bucket.hour}:00 • {bucket.posts} post{bucket.posts !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg text-primary">
                              {bucket.avgEngagement.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">engagement</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <div className="text-sm text-muted-foreground">
                    Not enough data yet. Publish more posts to see optimal posting times.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
  gradient = "from-muted/50 to-muted/30",
  iconColor = "text-primary",
  ...props
}: {
  title: string;
  value: number | string;
  loading: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  gradient?: string;
  iconColor?: string;
  [key: string]: any;
}) {
  return (
    <Card 
      className={cn(
        "border-border/40 shadow-lg rounded-2xl",
        "hover:shadow-xl hover:scale-[1.01] transition-all duration-300",
        "bg-gradient-to-br",
        gradient
      )}
      {...props}
    >
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5", iconColor)}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        {loading ? (
          <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/50 animate-pulse">-</div>
        ) : (
          <div className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
            variant === "destructive" ? "text-red-500" : "text-foreground"
          )}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
