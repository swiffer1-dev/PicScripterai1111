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
