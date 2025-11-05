import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { Share2, Clock, CheckCircle2, AlertCircle, Menu } from "lucide-react";
import type { Connection, Post } from "@shared/schema";
import { useState } from "react";
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

export default function Dashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: connections, isLoading: connectionsLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const connectedPlatforms = connections?.length || 0;
  const scheduledPosts = posts?.filter(p => p.status === "queued").length || 0;
  const publishedPosts = posts?.filter(p => p.status === "published").length || 0;
  const failedPosts = posts?.filter(p => p.status === "failed").length || 0;

  const recentPosts = posts?.slice(0, 5) || [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-background border-b border-border p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img 
            src={logoImage} 
            alt="Picscripterai" 
            className="h-12 w-auto object-contain"
            data-testid="img-logo-mobile-dashboard"
          />
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8 hidden lg:block">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1.5">Manage your social media posts</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Connected Platforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-connected-platforms">
                  {connectionsLoading ? "-" : connectedPlatforms}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-scheduled-posts">
                  {postsLoading ? "-" : scheduledPosts}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Published Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-published-posts">
                  {postsLoading ? "-" : publishedPosts}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed Posts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive" data-testid="stat-failed-posts">
                  {postsLoading ? "-" : failedPosts}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Posts */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold">Recent Posts</CardTitle>
                <Link href="/posts">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-posts">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                      <div className="h-12 w-12 bg-muted rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentPosts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No posts yet</p>
                  <Link href="/ai-studio">
                    <Button data-testid="button-create-first-post">Create your first post</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`post-item-${post.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium capitalize">{post.platform}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            post.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            post.status === "queued" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            post.status === "publishing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`} data-testid={`post-status-${post.id}`}>
                            {post.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.caption}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {post.scheduledAt
                            ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`
                            : `Created ${new Date(post.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
