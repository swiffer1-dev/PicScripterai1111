import type { AnalyticsOverview } from "../../../shared/analytics";

export async function getSquarespaceOverview(params: { from: string; to: string }): Promise<AnalyticsOverview> {
  const url = new URL("/api/analytics/squarespace/overview", window.location.origin);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}
