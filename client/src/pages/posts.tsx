import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { Plus, ExternalLink, Menu } from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiLinkedin, SiPinterest, SiYoutube, SiFacebook } from "react-icons/si";
import type { Post } from "@shared/schema";
import { useState } from "react";

const platformIcons = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  twitter: SiX,
  linkedin: SiLinkedin,
  pinterest: SiPinterest,
  youtube: SiYoutube,
  facebook: SiFacebook,
};

export default function Posts() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const sortedPosts = posts ? [...posts].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) : [];

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
          <h1 className="text-lg font-semibold">Picscripter</h1>
        </div>

        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="flex justify-between items-center mb-6 lg:mb-8">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight">Posts</h1>
              <p className="text-muted-foreground mt-1.5">View and manage all your posts</p>
            </div>
            <Link href="/create">
              <Button className="gap-2" data-testid="button-create-post">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Post</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="border-border animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 bg-muted rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <Card className="border-border shadow-sm">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No posts yet</p>
                <Link href="/create">
                  <Button data-testid="button-create-first-post">Create your first post</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => {
                const Icon = platformIcons[post.platform];
                
                return (
                  <Card key={post.id} className="border-border shadow-sm hover:shadow-md transition-shadow" data-testid={`post-card-${post.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm font-medium capitalize">{post.platform}</span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              post.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              post.status === "queued" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                              post.status === "publishing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`} data-testid={`post-status-${post.id}`}>
                              {post.status}
                            </span>
                            {post.externalUrl && (
                              <a
                                href={post.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                data-testid={`post-external-link-${post.id}`}
                              >
                                View post
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          
                          <p className="text-sm mb-2 line-clamp-3" data-testid={`post-caption-${post.id}`}>
                            {post.caption}
                          </p>
                          
                          {post.mediaUrl && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Media: {post.mediaType || "Unknown"}
                            </p>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            {post.scheduledAt
                              ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`
                              : `Created ${new Date(post.createdAt).toLocaleString()}`}
                          </p>
                          
                          {post.externalId && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              ID: {post.externalId}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
