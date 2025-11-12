export type Platform =
  | "instagram" | "tiktok" | "twitter" | "linkedin"
  | "pinterest" | "youtube" | "facebook"
  | "shopify" | "etsy" | "squarespace";

export type RangePreset = "7d" | "30d" | "90d" | "custom";

export interface TimeRange {
  from: string;
  to: string;
}

export interface Kpis {
  revenue?: number;
  orders?: number;
  aov?: number;
  conversionRate?: number;
  newCustomers?: number;
  repeatRate?: number;

  posts?: number;
  published?: number;
  failed?: number;
  captionsGenerated?: number;

  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface Timeseries {
  id: string;
  label: string;
  points: SeriesPoint[];
}

export interface AnalyticsOverview {
  platform?: Platform;
  kpis: Kpis;
  series: Timeseries[];
}
