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

// Helper to parse JSON and check response status
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// Default export for use with TanStack Query default fetcher
export const insightsService = {
  getSummary: async (days: number = 7): Promise<InsightsSummary> => {
    const res = await fetch(`/api/insights/summary?days=${days}`, { credentials: "include" });
    return json<InsightsSummary>(res);
  },

  getEngagement: async (days: number = 7): Promise<EngagementDataPoint[]> => {
    const res = await fetch(`/api/insights/engagement?days=${days}`, { credentials: "include" });
    return json<EngagementDataPoint[]>(res);
  },

  getTones: async (days: number = 7): Promise<TonePerformance[]> => {
    const res = await fetch(`/api/insights/tones?days=${days}`, { credentials: "include" });
    return json<TonePerformance[]>(res);
  },

  getBestTimes: async (days: number = 30): Promise<BestTimesData> => {
    const res = await fetch(`/api/insights/best-times?days=${days}`, { credentials: "include" });
    return json<BestTimesData>(res);
  },
};

export default insightsService;
