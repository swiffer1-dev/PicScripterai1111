import type { AnalyticsOverview, Kpis, Timeseries, Platform } from "@shared/analytics";

export type SummaryKpis = {
  connectedPlatforms: number;
  postsScheduled: number;
  postsPublished: number;
  publishFailed: number;
  captionsGenerated?: number;
};

export type EngagementPoint = {
  date: string;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
};

const json = async <T>(res: Response) => {
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
};

export async function getSummary(days: number): Promise<SummaryKpis> {
  const r = await fetch(`/api/analytics/summary?days=${days}`, { credentials: "include" });
  return json<SummaryKpis>(r);
}

export async function getEngagement(days: number): Promise<EngagementPoint[]> {
  const r = await fetch(`/api/analytics/engagement?days=${days}`, { credentials: "include" });
  return json<EngagementPoint[]>(r);
}

export type ToneMetric = { tone: string; count: number };
export async function getTopTones(days: number): Promise<ToneMetric[] | null> {
  const r = await fetch(`/api/analytics/top-tones?days=${days}`, { credentials: "include" });
  if (r.status === 404) return null;
  return json<ToneMetric[]>(r);
}

export function toSharedOverview(
  summary: SummaryKpis,
  engagement: EngagementPoint[]
): AnalyticsOverview {
  const kpis: Kpis = {
    posts: summary.postsScheduled,
    published: summary.postsPublished,
    failed: summary.publishFailed,
    captionsGenerated: summary.captionsGenerated,
    likes: engagement.reduce((sum, e) => sum + e.likes, 0),
    reposts: engagement.reduce((sum, e) => sum + e.reposts, 0),
    replies: engagement.reduce((sum, e) => sum + e.replies, 0),
    quotes: engagement.reduce((sum, e) => sum + e.quotes, 0),
  };

  const series: Timeseries[] = [
    {
      id: "likes",
      label: "Likes",
      points: engagement.map(e => ({ date: e.date, value: e.likes, label: "likes" })),
    },
    {
      id: "reposts",
      label: "Reposts",
      points: engagement.map(e => ({ date: e.date, value: e.reposts, label: "reposts" })),
    },
    {
      id: "replies",
      label: "Replies",
      points: engagement.map(e => ({ date: e.date, value: e.replies, label: "replies" })),
    },
    {
      id: "quotes",
      label: "Quotes",
      points: engagement.map(e => ({ date: e.date, value: e.quotes, label: "quotes" })),
    },
  ];

  return { kpis, series };
}

export function toSharedPlatformOverview(
  platform: Platform,
  summary: SummaryKpis,
  engagement: EngagementPoint[]
): AnalyticsOverview {
  const overview = toSharedOverview(summary, engagement);
  return { ...overview, platform };
}
