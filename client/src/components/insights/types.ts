// Shared types for Insights components
export interface KpiMetrics {
  totalPosts: number;
  publishedPosts: number;
  failedPosts: number;
  avgEngagement: number;
  topTone: string;
}

export interface EngagementDataPoint {
  date: string;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

export interface ToneData {
  tone: string;
  count: number;
  avgEngagement: number;
}

export interface TopPost {
  id: string;
  caption: string;
  platform: string;
  mediaUrl: string | null;
  imageUrls?: string[] | null;
  createdAt: string;
  metrics?: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  };
}
