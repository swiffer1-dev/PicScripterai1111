// PicScripter Insights API Service
export interface InsightsSummary {
  kpis: {
    postsCreated: number;
    published: number;
    failed: number;
    avgEngagementPerPost: number;
    topTone: string;
  };
}

export interface EngagementDataPoint {
  date: string;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

export interface TonePerformance {
  tone: string;
  count: number;
  avgEngagement: number;
}

export interface BestTimesData {
  tz: string;
  buckets: Array<{
    weekday: number; // 0-6 (Sunday-Saturday)
    hour: number; // 0-23
    posts: number;
    avgEngagement: number;
  }>;
}

// Default export for use with TanStack Query default fetcher
export const insightsService = {
  getSummary: (days: number = 7): Promise<InsightsSummary> =>
    fetch(`/api/insights/summary?days=${days}`).then(res => res.json()),

  getEngagement: (days: number = 7): Promise<EngagementDataPoint[]> =>
    fetch(`/api/insights/engagement?days=${days}`).then(res => res.json()),

  getTones: (days: number = 7): Promise<TonePerformance[]> =>
    fetch(`/api/insights/tones?days=${days}`).then(res => res.json()),

  getBestTimes: (days: number = 30): Promise<BestTimesData> =>
    fetch(`/api/insights/best-times?days=${days}`).then(res => res.json()),
};

export default insightsService;
