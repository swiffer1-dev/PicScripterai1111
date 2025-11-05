import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Send, Menu, CheckCircle, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { Platform, Connection, Draft } from "@shared/schema";
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

const platformCharLimits: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  twitter: 280,
  linkedin: 3000,
  pinterest: 500,
  youtube: 5000,
  facebook: 63206,
};

export default function Drafts() {
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [postingDraftId, setPostingDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  const { data: drafts, isLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const connectedPlatforms = new Set(connections?.map(c => c.platform) || []);

  const { data: pinterestBoards } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pinterest/boards"],
    enabled: connectedPlatforms.has('pinterest'),
    retry: false,
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (draftId: string) => apiRequest("DELETE", `/api/drafts/${draftId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft deleted",
        description: "Your draft has been removed",
      });
      setDeletingDraftId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      setDeletingDraftId(null);
    },
  });

  const postFromDraftMutation = useMutation({
    mutationFn: async (data: {
      draftId: string;
      caption: string;
      platforms: Platform[];
      mediaUrl?: string;
    }) => {
      const promises = data.platforms.map(platform => {
        const postData: any = {
          platform,
          caption: data.caption,
        };
        
        if (data.mediaUrl) {
          postData.media = {
            type: "image" as const,
            url: data.mediaUrl,
          };
        }
        
        if (platform === 'pinterest') {
          if (!pinterestBoards || pinterestBoards.length === 0) {
            throw new Error('No Pinterest boards found. Please create a board on Pinterest first.');
          }
          postData.options = {
            boardId: pinterestBoards[0].id,
            title: data.caption.substring(0, 100),
          };
        }
        
        return apiRequest("POST", "/api/posts", postData);
      });
      
      const results = await Promise.allSettled(promises);
      
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        throw new Error(`Failed to post to ${failures.length} platform(s): ${failures.map(f => f.reason.message).join(', ')}`);
      }
      
      // Delete draft after successful posting
      await apiRequest("DELETE", `/api/drafts/${data.draftId}`);
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Posted successfully!",
        description: "Your content has been posted and the draft has been removed",
      });
      setPostingDraftId(null);
      setSelectedPlatforms([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Posting failed",
        description: error.message,
        variant: "destructive",
      });
      setPostingDraftId(null);
    },
  });

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePostFromDraft = (draft: Draft) => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "No platforms selected",
        description: "Please select at least one connected platform",
        variant: "destructive",
      });
      return;
    }

    const captionLength = draft.caption.length;
    const platformsExceedingLimit = selectedPlatforms.filter(
      platform => captionLength > platformCharLimits[platform]
    );

    if (platformsExceedingLimit.length > 0) {
      const platformNames = platformsExceedingLimit
        .map(p => `${p.charAt(0).toUpperCase() + p.slice(1)} (${platformCharLimits[p]} max)`)
        .join(', ');
      
      toast({
        title: "Caption too long",
        description: `Your caption (${captionLength} characters) exceeds the limit for: ${platformNames}. Please shorten it or deselect those platforms.`,
        variant: "destructive",
      });
      return;
    }

    setPostingDraftId(draft.id);
    postFromDraftMutation.mutate({
      draftId: draft.id,
      caption: draft.caption,
      platforms: selectedPlatforms,
      mediaUrl: draft.mediaUrls?.[0],
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

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
            data-testid="img-logo-mobile-drafts"
          />
        </div>

        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Drafts</h1>
            <p className="text-muted-foreground mt-1.5">
              Your saved content ready to post
            </p>
          </div>

          {!drafts || drafts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground text-lg">
                  No drafts yet. Save content from the Create page to see it here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map(draft => (
                <Card key={draft.id} className="flex flex-col" data-testid={`card-draft-${draft.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2">
                          {draft.caption.substring(0, 50)}...
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-2">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(draft.createdAt), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    {draft.mediaUrls && draft.mediaUrls.length > 0 && (
                      <div className="mb-3">
                        <img
                          src={draft.mediaUrls[0]}
                          alt="Draft content"
                          className="w-full h-32 object-cover rounded-md"
                        />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {draft.caption}
                    </p>
                  </CardContent>
                  
                  <CardFooter className="flex flex-col gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            setPostingDraftId(draft.id);
                            setSelectedPlatforms([]);
                          }}
                          data-testid={`button-post-draft-${draft.id}`}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Post
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Select Platforms</DialogTitle>
                          <DialogDescription>
                            Choose which platforms to post this draft to
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid grid-cols-2 gap-3 my-4">
                          {(['instagram', 'facebook', 'pinterest', 'twitter', 'tiktok', 'linkedin', 'youtube'] as Platform[]).map(platform => {
                            const isConnected = connectedPlatforms.has(platform);
                            const isSelected = selectedPlatforms.includes(platform);
                            const captionLength = draft.caption.length;
                            const exceedsLimit = captionLength > platformCharLimits[platform];
                            
                            return (
                              <button
                                key={platform}
                                onClick={() => isConnected && !exceedsLimit && togglePlatform(platform)}
                                disabled={!isConnected || exceedsLimit}
                                className={`p-3 rounded-lg border transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : isConnected
                                    ? exceedsLimit
                                      ? 'bg-muted border-red-300 dark:border-red-700 opacity-50 cursor-not-allowed'
                                      : 'bg-card border-border hover:bg-muted'
                                    : 'bg-muted border-border opacity-50 cursor-not-allowed'
                                }`}
                                data-testid={`platform-${platform}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium capitalize">{platform}</span>
                                  {isConnected && isSelected && (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                  {(!isConnected || exceedsLimit) && (
                                    <AlertCircle className="h-4 w-4" />
                                  )}
                                </div>
                                {!isConnected && (
                                  <span className="text-xs text-muted-foreground mt-1 block">
                                    Not connected
                                  </span>
                                )}
                                {exceedsLimit && isConnected && (
                                  <span className="text-xs text-red-600 dark:text-red-400 mt-1 block">
                                    Too long ({captionLength}/{platformCharLimits[platform]})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <Button
                          onClick={() => handlePostFromDraft(draft)}
                          disabled={postFromDraftMutation.isPending || selectedPlatforms.length === 0}
                          className="w-full"
                          data-testid="button-confirm-post"
                        >
                          {postFromDraftMutation.isPending && postingDraftId === draft.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            `Post to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`
                          )}
                        </Button>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDeletingDraftId(draft.id);
                        deleteDraftMutation.mutate(draft.id);
                      }}
                      disabled={deletingDraftId === draft.id}
                      data-testid={`button-delete-draft-${draft.id}`}
                    >
                      {deletingDraftId === draft.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
