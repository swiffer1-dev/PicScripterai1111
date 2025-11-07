import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Menu, Calendar as CalendarIcon, Plus, X, AlertTriangle, CheckCircle } from "lucide-react";
import type { Post, Platform, Connection } from "@shared/schema";
import {
  SiInstagram,
  SiFacebook,
  SiLinkedin,
  SiPinterest,
  SiTiktok,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const platformIcons: Record<Platform, any> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  linkedin: SiLinkedin,
  pinterest: SiPinterest,
  tiktok: SiTiktok,
  twitter: SiX,
  youtube: SiYoutube,
};

const platformColors: Record<Platform, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-700",
  pinterest: "bg-red-600",
  tiktok: "bg-black",
  twitter: "bg-blue-400",
  youtube: "bg-red-600",
};

const platformCharLimits: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  twitter: 280,
  linkedin: 3000,
  pinterest: 500,
  youtube: 5000,
  facebook: 63206,
};

export default function Calendar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    caption: string;
    imageUrl: string | null;
    platform: Platform;
    scheduledAt: string;
  } | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const featureEnabled = import.meta.env.VITE_FEATURE_SCHEDULE_PENDING === "true";
  const { toast } = useToast();

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  // Use new calendar endpoint if feature enabled, otherwise use legacy posts endpoint
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const monthParam = `${year}-${month}`;
  
  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: featureEnabled ? ["/api/calendar", monthParam] : ["/api/posts"],
    queryFn: featureEnabled
      ? async () => {
          const response = await fetch(`/api/calendar?month=${monthParam}`, {
            credentials: 'include',
          });
          if (!response.ok) {
            throw new Error('Failed to fetch calendar');
          }
          return response.json();
        }
      : undefined, // Use default queryFn for legacy endpoint
  });

  // Check for draft data from AI Studio
  useEffect(() => {
    const draftData = sessionStorage.getItem('schedule-draft');
    if (draftData) {
      try {
        const parsed = JSON.parse(draftData);
        const firstConnection = connections?.[0];
        
        if (firstConnection) {
          // Calculate default schedule time (1 hour from now) in local timezone
          const defaultTime = new Date();
          defaultTime.setHours(defaultTime.getHours() + 1);
          defaultTime.setMinutes(0);
          defaultTime.setSeconds(0);
          defaultTime.setMilliseconds(0);
          
          // Format for datetime-local input (YYYY-MM-DDTHH:mm) in local timezone
          const year = defaultTime.getFullYear();
          const month = String(defaultTime.getMonth() + 1).padStart(2, '0');
          const day = String(defaultTime.getDate()).padStart(2, '0');
          const hours = String(defaultTime.getHours()).padStart(2, '0');
          const minutes = String(defaultTime.getMinutes()).padStart(2, '0');
          const localDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
          
          setScheduleData({
            caption: parsed.caption,
            imageUrl: parsed.imageUrl,
            platform: firstConnection.platform,
            scheduledAt: localDateTimeString,
          });
          setScheduleDialogOpen(true);
          
          // Clear session storage
          sessionStorage.removeItem('schedule-draft');
        }
      } catch (error) {
        console.error('Failed to parse draft data:', error);
      }
    }
  }, [connections]);

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: Date }) => {
      return await apiRequest("PATCH", `/api/posts/${id}`, { scheduledAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Post rescheduled",
        description: "Your post has been rescheduled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reschedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const schedulePostMutation = useMutation({
    mutationFn: async (data: {
      platform: Platform;
      caption: string;
      scheduledAt: string;
      imageUrl: string | null;
    }) => {
      // Convert datetime-local string to ISO string with timezone
      const scheduledAtISO = new Date(data.scheduledAt).toISOString();
      
      const payload: any = featureEnabled
        ? {
            platforms: selectedPlatforms.length > 0 
              ? selectedPlatforms.map(p => ({ provider: p }))
              : [{ provider: data.platform }],
            caption: data.caption,
            scheduledAt: scheduledAtISO,
          }
        : {
            platform: data.platform,
            caption: data.caption,
            scheduledAt: scheduledAtISO,
          };

      if (data.imageUrl) {
        payload.media = {
          type: "image",
          url: data.imageUrl,
        };
      }

      // Add Pinterest-specific options (only for single platform legacy mode)
      if (!featureEnabled && data.platform === "pinterest") {
        const boardsResponse = await apiRequest("GET", "/api/pinterest/boards") as unknown as { items: any[] };
        
        if (!boardsResponse.items || boardsResponse.items.length === 0) {
          throw new Error("No Pinterest boards found. Please create a board on Pinterest first.");
        }
        
        payload.options = {
          boardId: boardsResponse.items[0].id,
          title: data.caption.substring(0, 100),
          link: "https://www.pinterest.com",
        };
      }

      return await apiRequest("POST", "/api/schedule", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      // Invalidate all calendar queries (will match any month)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/calendar";
        }
      });
      setScheduleDialogOpen(false);
      setScheduleData(null);
      setSelectedPlatforms([]);
      toast({
        title: "Post scheduled!",
        description: "Your post has been scheduled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to schedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resolvePostMutation = useMutation({
    mutationFn: async (data: {
      postId: string;
      platforms: Platform[];
    }) => {
      return await apiRequest("PATCH", `/api/schedule/${data.postId}/resolve`, {
        platforms: data.platforms,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      // Invalidate all calendar queries (will match any month)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/calendar";
        }
      });
      setResolveDialogOpen(false);
      setSelectedPost(null);
      toast({
        title: "Post updated!",
        description: "Your post has been updated and will be scheduled if all issues are resolved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getPostsForDate = (date: Date | null) => {
    if (!date || !posts) return [];
    
    return posts.filter(post => {
      if (!post.scheduledAt) return false;
      const postDate = new Date(post.scheduledAt);
      return (
        postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const days = viewMode === "month" ? getDaysInMonth(currentDate) : getWeekDays(currentDate);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleScheduleSubmit = () => {
    if (!scheduleData) return;

    // Legacy mode: check if user has any connections
    if (!featureEnabled) {
      if (!connections || connections.length === 0) {
        toast({
          title: "No platforms connected",
          description: "Please connect at least one platform in the Connections page before scheduling",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate character limits for all selected platforms (when feature enabled)
    if (featureEnabled && selectedPlatforms.length > 0) {
      const overLimitPlatforms = selectedPlatforms.filter(
        platform => scheduleData.caption.length > platformCharLimits[platform]
      );
      
      if (overLimitPlatforms.length > 0) {
        toast({
          title: "Caption too long",
          description: `Caption exceeds limit for: ${overLimitPlatforms.join(', ')}`,
          variant: "destructive",
        });
        return;
      }
    } else if (!featureEnabled) {
      // Legacy single-platform validation
      const charLimit = platformCharLimits[scheduleData.platform];
      if (scheduleData.caption.length > charLimit) {
        toast({
          title: "Caption too long",
          description: `${scheduleData.platform} has a ${charLimit} character limit. Current: ${scheduleData.caption.length}`,
          variant: "destructive",
        });
        return;
      }
    }

    // Ensure at least one platform is selected when feature enabled
    if (featureEnabled && selectedPlatforms.length === 0) {
      toast({
        title: "No platforms selected",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    schedulePostMutation.mutate(scheduleData);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Resolve Issues Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Resolve Scheduling Issues
            </DialogTitle>
          </DialogHeader>
          
          {selectedPost && (
            <div className="space-y-4">
              {/* Post Info */}
              <div>
                <Label>Caption</Label>
                <p className="mt-1 text-sm text-muted-foreground">{selectedPost.caption}</p>
              </div>

              {/* Display Issues */}
              {(selectedPost as any).preflightIssues && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Issues Found:</h3>
                  <ul className="space-y-2">
                    {(selectedPost as any).preflightIssues.map((issue: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <div className="font-medium text-yellow-900 dark:text-yellow-100 capitalize">{issue.provider}:</div>
                        <ul className="ml-4 mt-1 space-y-1">
                          {issue.issues.map((msg: string, msgIdx: number) => (
                            <li key={msgIdx} className="text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                              <span className="text-yellow-600">•</span>
                              {msg}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Platform Selection to Resolve */}
              <div>
                <Label>Update Platforms</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {(['instagram', 'tiktok', 'twitter', 'linkedin', 'pinterest', 'youtube', 'facebook'] as Platform[]).map((platform) => {
                    const isConnected = connections?.some(c => c.platform === platform);
                    const isSelected = selectedPlatforms.includes(platform);
                    const Icon = platformIcons[platform];
                    
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                          } else {
                            setSelectedPlatforms([...selectedPlatforms, platform]);
                          }
                        }}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        } ${!isConnected ? 'opacity-50' : ''}`}
                        data-testid={`resolve-platform-${platform}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <Icon className="h-4 w-4" />
                        <span className="text-sm capitalize">{platform}</span>
                        {!isConnected && (
                          <span className="ml-auto text-xs text-muted-foreground">Not connected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Connect platforms in the Connections page to resolve issues.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResolveDialogOpen(false);
                    setSelectedPost(null);
                    setSelectedPlatforms([]);
                  }}
                  data-testid="button-cancel-resolve"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedPost) return;
                    resolvePostMutation.mutate({
                      postId: selectedPost.id,
                      platforms: selectedPlatforms,
                    });
                  }}
                  disabled={resolvePostMutation.isPending || selectedPlatforms.length === 0}
                  data-testid="button-confirm-resolve"
                >
                  {resolvePostMutation.isPending ? "Updating..." : "Update & Retry"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Scheduling Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
          </DialogHeader>
          
          {scheduleData && (
            <div className="space-y-4">
              {/* Image Preview */}
              {scheduleData.imageUrl && (
                <div>
                  <Label>Image</Label>
                  <img 
                    src={scheduleData.imageUrl} 
                    alt="Post preview" 
                    className="w-full max-h-64 object-cover rounded-lg border border-border mt-2"
                  />
                </div>
              )}

              {/* Platform Selection */}
              {featureEnabled ? (
                <div>
                  <Label>Select Platforms</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {(['instagram', 'tiktok', 'twitter', 'linkedin', 'pinterest', 'youtube', 'facebook'] as Platform[]).map((platform) => {
                      const isConnected = connections?.some(c => c.platform === platform);
                      const isSelected = selectedPlatforms.includes(platform);
                      const Icon = platformIcons[platform];
                      
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                            } else {
                              setSelectedPlatforms([...selectedPlatforms, platform]);
                            }
                          }}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          } ${!isConnected ? 'opacity-50' : ''}`}
                          data-testid={`checkbox-platform-${platform}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <Icon className="h-4 w-4" />
                          <span className="text-sm capitalize">{platform}</span>
                          {!isConnected && (
                            <span className="ml-auto text-xs text-muted-foreground">Not connected</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can schedule to platforms even if not connected. We'll notify you to connect them later.
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <select
                    id="platform"
                    value={scheduleData.platform}
                    onChange={(e) => setScheduleData({ ...scheduleData, platform: e.target.value as Platform })}
                    className="w-full mt-2 bg-background border border-border rounded-lg py-2 px-3"
                    data-testid="select-platform"
                  >
                    {connections?.map((conn) => (
                      <option key={conn.platform} value={conn.platform}>
                        {conn.platform.charAt(0).toUpperCase() + conn.platform.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Caption */}
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="caption">Caption</Label>
                  <span className={`text-xs ${
                    scheduleData.caption.length > platformCharLimits[scheduleData.platform]
                      ? "text-destructive font-semibold"
                      : "text-muted-foreground"
                  }`}>
                    {scheduleData.caption.length} / {platformCharLimits[scheduleData.platform]}
                  </span>
                </div>
                <Textarea
                  id="caption"
                  value={scheduleData.caption}
                  onChange={(e) => setScheduleData({ ...scheduleData, caption: e.target.value })}
                  className="mt-2 min-h-[200px]"
                  data-testid="input-caption"
                />
                {scheduleData.caption.length > platformCharLimits[scheduleData.platform] && (
                  <p className="text-xs text-destructive mt-1">
                    Caption exceeds {scheduleData.platform}'s character limit. Please shorten it.
                  </p>
                )}
              </div>

              {/* Schedule Date/Time */}
              <div>
                <Label htmlFor="scheduledAt">Schedule Date & Time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduleData.scheduledAt}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduledAt: e.target.value })}
                  className="mt-2"
                  data-testid="input-schedule-time"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScheduleDialogOpen(false);
                    setScheduleData(null);
                  }}
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleScheduleSubmit}
                  disabled={schedulePostMutation.isPending || scheduleData.caption.length > platformCharLimits[scheduleData.platform]}
                  data-testid="button-confirm-schedule"
                >
                  {schedulePostMutation.isPending ? "Scheduling..." : "Schedule Post"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-30 bg-background border-b border-border p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Content Calendar</h1>
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 lg:mb-8">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
                <CalendarIcon className="h-8 w-8" />
                Content Calendar
              </h1>
              <p className="text-muted-foreground mt-1.5">Plan and schedule your social media posts</p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="gap-2" 
                onClick={() => {
                  // Open schedule dialog with empty data
                  const defaultTime = new Date();
                  defaultTime.setHours(defaultTime.getHours() + 1);
                  defaultTime.setMinutes(0);
                  defaultTime.setSeconds(0);
                  defaultTime.setMilliseconds(0);
                  
                  const year = defaultTime.getFullYear();
                  const month = String(defaultTime.getMonth() + 1).padStart(2, '0');
                  const day = String(defaultTime.getDate()).padStart(2, '0');
                  const hours = String(defaultTime.getHours()).padStart(2, '0');
                  const minutes = String(defaultTime.getMinutes()).padStart(2, '0');
                  const localDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
                  
                  setScheduleData({
                    caption: '',
                    imageUrl: null,
                    platform: connections?.[0]?.platform || 'instagram',
                    scheduledAt: localDateTimeString,
                  });
                  setSelectedPlatforms([]);
                  setScheduleDialogOpen(true);
                }}
                data-testid="button-schedule-post"
              >
                <CalendarIcon className="h-4 w-4" />
                Schedule Post
              </Button>
              <Link href="/ai-studio">
                <Button className="gap-2" data-testid="button-create-post">
                  <Plus className="h-4 w-4" />
                  Create Post
                </Button>
              </Link>
            </div>
          </div>

          <Card className="border-border shadow-sm p-4">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => viewMode === "month" ? navigateMonth(-1) : navigateWeek(-1)}
                  data-testid="button-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold min-w-[200px] text-center">{monthName}</h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => viewMode === "month" ? navigateMonth(1) : navigateWeek(1)}
                  data-testid="button-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-month-view"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-week-view"
                >
                  Week
                </Button>
              </div>
            </div>

            <div className={`grid ${viewMode === "month" ? "grid-cols-7" : "grid-cols-7"} gap-2 mb-2`}>
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className={`grid ${viewMode === "month" ? "grid-cols-7" : "grid-cols-7"} gap-2`}>
              {days.map((day, index) => {
                const dayPosts = getPostsForDate(day);
                const isToday = day && 
                  day.getDate() === new Date().getDate() &&
                  day.getMonth() === new Date().getMonth() &&
                  day.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={index}
                    className={`min-h-[120px] border border-border rounded-lg p-2 ${
                      day ? "bg-card" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-primary" : ""}`}
                    data-testid={day ? `calendar-day-${day.getDate()}` : undefined}
                  >
                    {day && (
                      <>
                        <div className="text-sm font-medium mb-2">{day.getDate()}</div>
                        <div className="space-y-1">
                          {dayPosts.slice(0, 3).map(post => {
                            const isPending = post.status === 'scheduled_pending';
                            const platforms = (post as any).platforms;
                            const isMultiPlatform = Array.isArray(platforms) && platforms.length > 1;
                            
                            // For multi-platform posts, show the first platform icon
                            const displayPlatform = (isMultiPlatform ? platforms[0].provider : post.platform) as Platform;
                            const Icon = platformIcons[displayPlatform] || platformIcons.instagram;
                            const platformColor = platformColors[displayPlatform] || platformColors.instagram;
                            
                            return (
                              <div
                                key={post.id}
                                className={`text-xs p-1.5 rounded flex items-center gap-1 truncate cursor-pointer transition-all hover:opacity-80 ${
                                  isPending 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100 border border-yellow-300 dark:border-yellow-600'
                                    : `text-white ${platformColor}`
                                }`}
                                title={post.caption}
                                onClick={() => {
                                  if (isPending) {
                                    setSelectedPost(post);
                                    setResolveDialogOpen(true);
                                  }
                                }}
                                data-testid={`post-${post.id}`}
                              >
                                {isPending && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}
                                <Icon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{post.caption.substring(0, 15)}...</span>
                                {isMultiPlatform && (
                                  <span className="ml-auto text-xs">+{platforms.length - 1}</span>
                                )}
                              </div>
                            );
                          })}
                          {dayPosts.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayPosts.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {isLoading && (
            <div className="mt-8 text-center text-muted-foreground">
              Loading calendar...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
