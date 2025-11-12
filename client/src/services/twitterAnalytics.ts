import type { AnalyticsOverview } from "../../../shared/analytics";

export async function getTwitterOverview(params: { from: string; to: string }): Promise<AnalyticsOverview> {
  const url = new URL("/api/analytics/twitter/overview", window.location.origin);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AnalyticsOverview>;
}
