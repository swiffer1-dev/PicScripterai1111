import { FileText, Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { TopPost } from "./types";

interface TopPostsCardProps {
  posts: TopPost[];
}

export function TopPostsCard({ posts }: TopPostsCardProps) {
  const topPosts = posts ?? [];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg p-6 hover:shadow-xl hover:border-purple-500/60 hover:-translate-y-[1px] transition-all duration-200" data-testid="card-top-posts">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white" data-testid="heading-top-posts-title">Top Posts (Last 30 Days)</h3>
        <p className="text-sm text-slate-400 mt-1" data-testid="text-top-posts-subtitle">
          Your most recent published content
        </p>
      </div>

      {topPosts.length > 0 ? (
        <div className="space-y-4" data-testid="table-top-posts">
          {topPosts.map((post) => {
            const metrics = post.metrics;
            const mediaUrl = post.mediaUrl || (post.imageUrls && post.imageUrls[0]);
            
            return (
              <div
                key={post.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200"
                data-testid={`post-${post.id}`}
              >
                {/* Thumbnail */}
                {mediaUrl ? (
                  <img
                    src={mediaUrl}
                    alt="Post thumbnail"
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                    data-testid={`img-post-thumbnail-${post.id}`}
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0 border border-slate-700"
                    data-testid={`placeholder-post-thumbnail-${post.id}`}
                  >
                    <FileText className="h-6 w-6 text-slate-500" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white line-clamp-2 mb-2" data-testid={`text-post-caption-${post.id}`}>
                    {post.caption || "No caption"}
                  </p>

                  {/* Metrics */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {metrics ? (
                      <>
                        <span className="flex items-center gap-1" data-testid={`metric-likes-${post.id}`}>
                          <Heart className="h-3 w-3" />
                          {metrics.likes ?? 0}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`metric-replies-${post.id}`}>
                          <MessageCircle className="h-3 w-3" />
                          {metrics.replies ?? 0}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`metric-reposts-${post.id}`}>
                          <Repeat2 className="h-3 w-3" />
                          {metrics.reposts ?? 0}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`metric-quotes-${post.id}`}>
                          💬 {metrics.quotes ?? 0}
                        </span>
                      </>
                    ) : (
                      <span className="capitalize px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs" data-testid={`platform-badge-${post.id}`}>
                        {post.platform}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center text-center px-4" data-testid="empty-top-posts-state">
          <FileText className="h-12 w-12 text-slate-600 mb-3" />
          <div className="text-slate-400 mb-2">No top posts yet</div>
          <div className="text-sm text-slate-500">
            Create and publish posts to see what performs best!
          </div>
        </div>
      )}
    </div>
  );
}
