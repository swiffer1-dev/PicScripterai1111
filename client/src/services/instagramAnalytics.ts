import type { AnalyticsOverview } from "../../../shared/analytics";

export async function getInstagramOverview(params: { from: string; to: string }): Promise<AnalyticsOverview> {
  const u = new URL("/api/analytics/instagram/overview", window.location.origin);
  u.searchParams.set("from", params.from);
  u.searchParams.set("to", params.to);
  const r = await fetch(u, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
