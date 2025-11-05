import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { Plus, ExternalLink, Menu, X, Copy, Edit, Sparkles } from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiLinkedin, SiPinterest, SiYoutube, SiFacebook } from "react-icons/si";
import type { Post } from "@shared/schema";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/9d027683-80c2-4c91-884a-86938f55ece9_1762314951318.jpeg";

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
  const { toast } = useToast();
  
  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest("DELETE", `/api/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post deleted",
        description: "The post has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (post: Post) => {
      const duplicatedPost: {
        platform: string;
        caption: string;
        status: "draft";
        options: any;
        media?: { type: string; url: string };
      } = {
        platform: post.platform,
        caption: post.caption,
        status: "draft" as const,
        options: post.options,
      };
      
      // Include media if present
      if (post.mediaType && post.mediaUrl) {
        duplicatedPost.media = {
          type: post.mediaType,
          url: post.mediaUrl,
        };
      }
      
      return await apiRequest("POST", "/api/posts", duplicatedPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post duplicated",
        description: "A draft copy has been created",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Duplication failed",
        description: error.message,
        variant: "destructive",
      });
    },
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
          <img 
            src={logoImage} 
            alt="Picscripterai" 
            className="h-8 w-auto object-contain"
            data-testid="img-logo-mobile-posts"
          />
        </div>

        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight">Posts</h1>
              <p className="text-muted-foreground mt-1.5">View and manage all your posts</p>
            </div>
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
                <p className="text-muted-foreground">No posts yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create content using the Create page in the sidebar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => {
                const Icon = platformIcons[post.platform];
                
                return (
                  <Card key={post.id} className="border-border shadow-sm hover:shadow-md transition-shadow relative" data-testid={`post-card-${post.id}`}>
                    <CardContent className="p-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => deleteMutation.mutate(post.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-post-${post.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0 pr-8">
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

                          <div className="flex gap-2 mt-4 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateMutation.mutate(post)}
                              disabled={duplicateMutation.isPending}
                              className="gap-1 text-xs"
                              data-testid={`button-duplicate-${post.id}`}
                            >
                              <Copy className="h-3 w-3" />
                              Duplicate
                            </Button>
                            <Link href={`/ai-studio?caption=${encodeURIComponent(post.caption)}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                data-testid={`button-edit-repost-${post.id}`}
                              >
                                <Edit className="h-3 w-3" />
                                Edit & Repost
                              </Button>
                            </Link>
                            <Link href={`/ai-studio?caption=${encodeURIComponent(post.caption)}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                data-testid={`button-send-to-ai-${post.id}`}
                              >
                                <Sparkles className="h-3 w-3" />
                                Send to Create
                              </Button>
                            </Link>
                          </div>
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
