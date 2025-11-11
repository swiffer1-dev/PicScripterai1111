import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Clock, CheckCircle2, AlertCircle, Menu, Activity, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { Connection, Post } from "@shared/schema";
import { useState } from "react";
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

interface EngagementSummary {
  totals: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
  daily: Array<{
    date: string;
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  }>;
}

interface TonePerformance {
  tone: string;
  avg_engagement: number;
  samples: number;
}

export default function Dashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7);
  
  const { data: connections, isLoading: connectionsLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: analytics7Day } = useQuery<Record<string, number>>({
    queryKey: ["/api/analytics/summary", { days: 7 }],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/analytics/summary?days=7", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: analytics30Day } = useQuery<Record<string, number>>({
    queryKey: ["/api/analytics/summary", { days: 30 }],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/analytics/summary?days=30", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const currentAnalytics = analyticsDays === 7 ? analytics7Day : analytics30Day;

  // Engagement analytics (feature-flagged)
  const engagementEnabled = import.meta.env.VITE_METRICS_ENGAGEMENT === '1';
  
  const { data: engagementSummary } = useQuery<EngagementSummary>({
    queryKey: ["/api/metrics/engagement/summary", { days: 7 }],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/metrics/engagement/summary?days=7", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch engagement metrics");
      return res.json();
    },
    enabled: engagementEnabled,
  });

  const { data: tonePerformance } = useQuery<TonePerformance[]>({
    queryKey: ["/api/metrics/tones/performance", { days: 30 }],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/metrics/tones/performance?days=30", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tone performance");
      return res.json();
    },
    enabled: engagementEnabled,
  });

  const connectedPlatforms = connections?.length || 0;
  const scheduledPosts = posts?.filter(p => p.status === "queued").length || 0;
  const publishedPosts = posts?.filter(p => p.status === "published").length || 0;
  const failedPosts = posts?.filter(p => p.status === "failed").length || 0;

  const recentPosts = posts?.slice(0, 5) || [];

  const chartData = [
    {
      name: "Captions Generated",
      count: currentAnalytics?.caption_generated || 0,
    },
    {
      name: "Posts Scheduled",
      count: currentAnalytics?.post_scheduled || 0,
    },
    {
      name: "Posts Published",
      count: currentAnalytics?.post_published || 0,
    },
    {
      name: "Publish Failed",
      count: currentAnalytics?.publish_failed || 0,
    },
  ];

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
          <div className="flex items-center h-full">
            <img 
              src={logoImage} 
              alt="PicScripterAI" 
              loading="lazy"
              className="
                px-3
                h-auto
                w-[150px]
                sm:w-[200px]
                lg:w-[260px]
                max-w-full
              "
              data-testid="img-logo-mobile-dashboard"
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8 hidden lg:block">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1.5">Manage your social media posts</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Connected Platforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-connected-platforms">
                  {connectionsLoading ? "-" : connectedPlatforms}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-scheduled-posts">
                  {postsLoading ? "-" : scheduledPosts}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Published Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-published-posts">
                  {postsLoading ? "-" : publishedPosts}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive" data-testid="stat-failed-posts">
                  {postsLoading ? "-" : failedPosts}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Chart */}
          <Card className="border-border shadow-sm mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Analytics
                </CardTitle>
                <Tabs value={analyticsDays.toString()} onValueChange={(val) => setAnalyticsDays(parseInt(val) as 7 | 30)}>
                  <TabsList>
                    <TabsTrigger value="7" data-testid="tab-7-days">Last 7 Days</TabsTrigger>
                    <TabsTrigger value="30" data-testid="tab-30-days">Last 30 Days</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    data-testid="analytics-chart-line"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center" data-testid="analytics-caption-generated">
                  <div className="text-2xl font-bold">{currentAnalytics?.caption_generated || 0}</div>
                  <div className="text-xs text-muted-foreground">Captions Generated</div>
                </div>
                <div className="text-center" data-testid="analytics-post-scheduled">
                  <div className="text-2xl font-bold">{currentAnalytics?.post_scheduled || 0}</div>
                  <div className="text-xs text-muted-foreground">Posts Scheduled</div>
                </div>
                <div className="text-center" data-testid="analytics-post-published">
                  <div className="text-2xl font-bold">{currentAnalytics?.post_published || 0}</div>
                  <div className="text-xs text-muted-foreground">Posts Published</div>
                </div>
                <div className="text-center" data-testid="analytics-publish-failed">
                  <div className="text-2xl font-bold text-destructive">{currentAnalytics?.publish_failed || 0}</div>
                  <div className="text-xs text-muted-foreground">Publish Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Analytics (feature-flagged) */}
          {engagementEnabled && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Engagement Time Series */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Engagement Analytics (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center" data-testid="engagement-total-likes">
                      <div className="text-2xl font-bold">{engagementSummary?.totals.likes || 0}</div>
                      <div className="text-xs text-muted-foreground">Likes</div>
                    </div>
                    <div className="text-center" data-testid="engagement-total-reposts">
                      <div className="text-2xl font-bold">{engagementSummary?.totals.reposts || 0}</div>
                      <div className="text-xs text-muted-foreground">Reposts</div>
                    </div>
                    <div className="text-center" data-testid="engagement-total-replies">
                      <div className="text-2xl font-bold">{engagementSummary?.totals.replies || 0}</div>
                      <div className="text-xs text-muted-foreground">Replies</div>
                    </div>
                    <div className="text-center" data-testid="engagement-total-quotes">
                      <div className="text-2xl font-bold">{engagementSummary?.totals.quotes || 0}</div>
                      <div className="text-xs text-muted-foreground">Quotes</div>
                    </div>
                  </div>

                  {engagementSummary && engagementSummary.daily.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={engagementSummary.daily}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Legend />
                        <Bar dataKey="likes" fill="hsl(var(--primary))" stackId="a" data-testid="engagement-chart-likes" />
                        <Bar dataKey="reposts" fill="#10b981" stackId="a" data-testid="engagement-chart-reposts" />
                        <Bar dataKey="replies" fill="#f59e0b" stackId="a" data-testid="engagement-chart-replies" />
                        <Bar dataKey="quotes" fill="#8b5cf6" stackId="a" data-testid="engagement-chart-quotes" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground" data-testid="engagement-no-data">
                      No engagement data yet. Publish some Twitter posts to see metrics!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Performing Tones */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top Performing Tones (30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tonePerformance && tonePerformance.length > 0 ? (
                    <div className="space-y-3">
                      {tonePerformance.slice(0, 5).map((tone, index) => (
                        <div 
                          key={tone.tone} 
                          className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                          data-testid={`tone-performance-${index}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium capitalize">{tone.tone}</div>
                            <div className="text-xs text-muted-foreground">{tone.samples} posts</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold" data-testid={`tone-avg-engagement-${index}`}>
                              {tone.avg_engagement}
                            </div>
                            <div className="text-xs text-muted-foreground">Avg. Engagement</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground" data-testid="tones-no-data">
                      No tone data yet. Create posts with different tones to see performance insights!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Posts */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold">Recent Posts</CardTitle>
                <Link href="/posts">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-posts">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                      <div className="h-12 w-12 bg-muted rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentPosts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No posts yet</p>
                  <Link href="/ai-studio">
                    <Button data-testid="button-create-first-post">Create your first post</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`post-item-${post.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium capitalize">{post.platform}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            post.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            post.status === "queued" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            post.status === "publishing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`} data-testid={`post-status-${post.id}`}>
                            {post.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.caption}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {post.scheduledAt
                            ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`
                            : `Created ${new Date(post.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
