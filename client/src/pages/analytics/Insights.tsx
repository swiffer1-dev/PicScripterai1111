import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import insightsService, {
  type InsightsSummary,
  type EngagementDataPoint,
  type TonePerformance,
} from "@/services/insights";
import type { Post } from "@shared/schema";
import {
  InsightsHeader,
  InsightsKpiRow,
  InsightsEngagementChart,
  TonePerformanceCard,
  TopPostsCard,
  type KpiMetrics,
  type TopPost,
} from "@/components/insights";
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

export default function InsightsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [range, setRange] = useState<7 | 30 | 90>(7);

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

  const { data: posts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  // Map API response to KPI metrics view-model
  const kpiMetrics: KpiMetrics = {
    totalPosts: summary?.kpis.postsCreated ?? 0,
    publishedPosts: summary?.kpis.published ?? 0,
    failedPosts: summary?.kpis.failed ?? 0,
    avgEngagement: summary?.kpis.avgEngagementPerPost ?? 0,
    topTone: summary?.kpis.topTone ?? "",
  };

  const rangeLabel = `${range} days`;

  const engagementData: EngagementDataPoint[] = engagement ?? [];
  const toneData = tones ?? [];

  // Map posts to top posts view-model - filter, sort, and normalize
  const topPosts: TopPost[] = (posts ?? [])
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((p) => {
      const postWithExtras = p as Post & { imageUrls?: string[] | null; metrics?: { likes: number; replies: number; reposts: number; quotes: number } };
      return {
        id: p.id,
        caption: p.caption,
        platform: p.platform,
        mediaUrl: p.mediaUrl,
        imageUrls: postWithExtras.imageUrls ?? null,
        createdAt: new Date(p.createdAt).toISOString(),
        metrics: postWithExtras.metrics 
          ? {
              likes: postWithExtras.metrics.likes ?? 0,
              replies: postWithExtras.metrics.replies ?? 0,
              reposts: postWithExtras.metrics.reposts ?? 0,
              quotes: postWithExtras.metrics.quotes ?? 0,
            }
          : undefined,
      };
    });

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
          <img 
            src={logoImage} 
            alt="Picscripterai" 
            className="h-12 w-auto object-contain"
            data-testid="img-logo-mobile-insights"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 lg:py-10">
          {/* Header with time range control */}
          <InsightsHeader range={range} onRangeChange={setRange} />

          {/* KPI Overview Row */}
          <InsightsKpiRow metrics={kpiMetrics} rangeLabel={rangeLabel} />

          {/* Engagement Over Time Chart */}
          <InsightsEngagementChart 
            data={engagementData} 
            isLoading={engagementLoading} 
          />

          {/* Bottom Row: Tone Performance + Top Posts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6" data-testid="section-bottom-row">
            <TonePerformanceCard tones={toneData} isLoading={tonesLoading} />
            <TopPostsCard posts={topPosts} />
          </div>
        </div>
      </main>
    </div>
  );
}
