import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Menu, Calendar as CalendarIcon, Plus, X, AlertTriangle, CheckCircle, Copy, Eye } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScheduleDrawer } from "@/components/ScheduleDrawer";
import { useCalendarData } from "@/hooks/useCalendarData";

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
  const [postDetails, setPostDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "resolve">("preview");
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const featureEnabled = import.meta.env.VITE_FEATURE_SCHEDULE_PENDING === "true";
  
  // New interactive calendar feature
  // Note: Hardcoded to true since .env variables aren't being picked up by Vite in this custom server setup
  const scheduleUIEnabled = true;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<Date>(new Date());
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerScheduleId, setDrawerScheduleId] = useState<string | undefined>(undefined);
  
  const { toast } = useToast();
  
  // Use calendar data hook for status dots (when feature enabled)
  const calendarData = useCalendarData(currentDate);

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

  // Check for draft data from AI Studio on component mount
  useEffect(() => {
    const draftData = sessionStorage.getItem('schedule-draft');
    console.log('📅 Calendar checking for draft data:', { hasDraft: !!draftData, hasConnections: !!connections, connectionsLength: connections?.length });
    
    // Open drawer immediately if we have draft data, don't wait for connections
    if (draftData) {
      try {
        const parsed = JSON.parse(draftData);
        console.log('📅 Parsed draft data:', parsed);
        
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
        
        const draftDataForDrawer = {
          caption: parsed.caption,
          imageUrl: parsed.imageUrl,
          platforms: parsed.platforms || [],
          category: parsed.category,
          tone: parsed.tone,
          scheduledAt: localDateTimeString,
        };
        
        console.log('📅 Opening drawer with data:', draftDataForDrawer);
        
        // Use unified schedule drawer - open immediately, don't wait for connections
        setDrawerDate(defaultTime);
        setDrawerMode('create');
        setDrawerScheduleId(undefined);
        setDrawerOpen(true);
        
        // Store draft data for the drawer to use, including platforms
        sessionStorage.setItem('schedule-draft-data', JSON.stringify(draftDataForDrawer));
        
        // Clear the trigger storage
        sessionStorage.removeItem('schedule-draft');
        
        console.log('📅 Drawer opened successfully');
      } catch (error) {
        console.error('❌ Failed to parse draft data:', error);
      }
    }
  }, []); // Run only once on mount - don't wait for connections

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
  
  // Helper to get status dots for a day (when feature enabled)
  const getStatusDotsForDay = (day: Date | null) => {
    if (!day || !scheduleUIEnabled || !calendarData.data) return [];
    
    const dateKey = format(day, "yyyy-MM-dd");
    const posts = calendarData.data[dateKey] || [];
    
    // Count statuses
    const statusCounts = posts.reduce((acc: any, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {});
    
    const dots = [];
    if (statusCounts.scheduled_pending) dots.push({ status: "pending", color: "bg-gray-400", count: statusCounts.scheduled_pending });
    if (statusCounts.scheduled) dots.push({ status: "scheduled", color: "bg-blue-500", count: statusCounts.scheduled });
    if (statusCounts.published) dots.push({ status: "published", color: "bg-green-500", count: statusCounts.published });
    if (statusCounts.failed) dots.push({ status: "failed", color: "bg-red-500", count: statusCounts.failed });
    
    return dots.slice(0, 3); // Max 3 dots
  };
  
  // Handle day cell click (when feature enabled)
  const handleDayClick = (day: Date | null) => {
    if (!day || !scheduleUIEnabled) return;
    
    setDrawerDate(day);
    setDrawerMode('create');
    setDrawerScheduleId(undefined);
    setDrawerOpen(true);
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
      {/* Post Preview & Resolve Dialog (legacy - only when feature disabled) */}
      {!scheduleUIEnabled && (
      <Dialog open={resolveDialogOpen} onOpenChange={(open) => {
        setResolveDialogOpen(open);
        if (!open) {
          setSelectedPost(null);
          setPostDetails(null);
          setSelectedPlatforms([]);
          setActiveTab("preview");
          setCaptionExpanded(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="post-preview-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Post Details
            </DialogTitle>
            <p id="post-preview-description" className="sr-only">
              Preview and manage your scheduled post
            </p>
          </DialogHeader>
          
          {selectedPost && (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "preview" | "resolve")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
                <TabsTrigger value="resolve" data-testid="tab-resolve">
                  Resolve
                  {(selectedPost as any).preflightIssues && (
                    <AlertTriangle className="h-3 w-3 ml-1 text-yellow-600" />
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="space-y-4 mt-4">
                {postDetails && postDetails.caption !== undefined ? (
                  <>
                    {/* Media Thumbnail */}
                    {postDetails.media && postDetails.media.length > 0 && (
                      <div className="relative">
                        <img
                          src={postDetails.media[0].url}
                          alt="Post media"
                          loading="lazy"
                          className="w-full max-h-64 object-cover rounded-lg border border-border"
                          data-testid="preview-image"
                        />
                        {postDetails.media.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                            +{postDetails.media.length - 1} more
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Caption */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Caption</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(postDetails.caption);
                            toast({ title: "Copied to clipboard!" });
                          }}
                          className="h-8"
                          data-testid="button-copy-caption"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className={`text-sm text-foreground whitespace-pre-wrap ${!captionExpanded ? 'line-clamp-3' : ''}`}>
                        {postDetails.caption || ''}
                      </div>
                      {postDetails.caption && postDetails.caption.length > 150 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setCaptionExpanded(!captionExpanded)}
                          className="p-0 h-auto mt-1"
                          data-testid="button-toggle-caption"
                        >
                          {captionExpanded ? 'Show less' : 'Show more'}
                        </Button>
                      )}
                    </div>
                    
                    {/* Scheduled Time */}
                    <div>
                      <Label>Scheduled For</Label>
                      <p className="text-sm text-foreground mt-1">
                        {new Date(postDetails.scheduledAt).toLocaleString(undefined, {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    
                    {/* Tone */}
                    {postDetails.tone && (
                      <div>
                        <Label>Tone</Label>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary capitalize border border-primary/20">
                            {postDetails.tone}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Platform Status */}
                    <div>
                      <Label>Platforms</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {postDetails.platforms && postDetails.platforms.map((platform: any, idx: number) => {
                          const Icon = platformIcons[platform.provider as Platform];
                          const statusColor = 
                            platform.status === 'published' ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border-green-300 dark:border-green-600' :
                            platform.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-600' :
                            platform.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 border-red-300 dark:border-red-600' :
                            'bg-gray-100 dark:bg-gray-900/30 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600';
                          
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${statusColor}`}
                              data-testid={`platform-chip-${platform.provider}`}
                            >
                              <Icon className="h-4 w-4" />
                              <span className="capitalize">{platform.provider}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Character Counts */}
                    <div>
                      <Label>Character Counts</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {postDetails.charCounts && Object.entries(postDetails.charCounts).map(([platform, counts]: [string, any]) => {
                          const isOverLimit = counts.current > counts.limit;
                          return (
                            <div
                              key={platform}
                              className={`flex items-center justify-between p-2 rounded border ${
                                isOverLimit ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600' : 'border-border'
                              }`}
                              data-testid={`char-count-${platform}`}
                            >
                              <span className="text-sm capitalize">{platform}</span>
                              <span className={`text-sm font-medium ${isOverLimit ? 'text-red-600 dark:text-red-400' : ''}`}>
                                {counts.current} / {counts.limit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Error Banner */}
                    {postDetails.lastError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-900 dark:text-red-100">Publishing Error</h4>
                            <p className="text-sm text-red-800 dark:text-red-200 mt-1">{postDetails.lastError}</p>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setActiveTab("resolve")}
                              className="p-0 h-auto mt-2 text-red-700 dark:text-red-300"
                              data-testid="button-see-resolve"
                            >
                              See Resolve tab →
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Loading post details...
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="resolve" className="space-y-4 mt-4">
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
                      setPostDetails(null);
                      setSelectedPlatforms([]);
                      setActiveTab("preview");
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
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      )}

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
                  if (scheduleUIEnabled) {
                    // Open new drawer
                    const defaultTime = new Date();
                    defaultTime.setHours(defaultTime.getHours() + 1);
                    defaultTime.setMinutes(0, 0, 0);
                    setDrawerDate(defaultTime);
                    setDrawerMode('create');
                    setDrawerScheduleId(undefined);
                    setDrawerOpen(true);
                  } else {
                    // Open legacy schedule dialog
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
                  }
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

          <Card className="border-border shadow-sm p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => viewMode === "month" ? navigateMonth(-1) : navigateWeek(-1)}
                  data-testid="button-prev"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <h2 className="text-base sm:text-xl font-semibold text-center flex-1 sm:min-w-[200px]">{monthName}</h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => viewMode === "month" ? navigateMonth(1) : navigateWeek(1)}
                  data-testid="button-next"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-month-view"
                  className="flex-1 sm:flex-initial"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-week-view"
                  className="flex-1 sm:flex-initial"
                >
                  Week
                </Button>
              </div>
            </div>

            <div className={`grid ${viewMode === "month" ? "grid-cols-7" : "grid-cols-7"} gap-1 sm:gap-2 mb-2`}>
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                  <span className="sm:hidden">{day.charAt(0)}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>

            <div className={`grid ${viewMode === "month" ? "grid-cols-7" : "grid-cols-7"} gap-1 sm:gap-2`}>
              {days.map((day, index) => {
                const dayPosts = getPostsForDate(day);
                const statusDots = getStatusDotsForDay(day);
                const isToday = day && 
                  day.getDate() === new Date().getDate() &&
                  day.getMonth() === new Date().getMonth() &&
                  day.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={index}
                    className={`min-h-[88px] sm:min-h-[120px] border border-border rounded-lg p-1 sm:p-2 transition-all duration-200 ${
                      day ? "bg-card" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-primary" : ""} ${
                      scheduleUIEnabled && day ? "cursor-pointer hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-[1.02]" : ""
                    }`}
                    onClick={() => handleDayClick(day)}
                    data-testid={day ? `calendar-day-${day.getDate()}` : undefined}
                  >
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{day.getDate()}</div>
                          {scheduleUIEnabled && statusDots.length > 0 && (
                            <div className="flex gap-1" title={`${statusDots.map(d => `${d.status}: ${d.count}`).join(', ')}`}>
                              {statusDots.map((dot, idx) => (
                                <div
                                  key={idx}
                                  className={`w-2 h-2 rounded-full ${dot.color}`}
                                  data-testid={`status-dot-${dot.status}`}
                                />
                              ))}
                              {Object.keys(calendarData.data?.[format(day, "yyyy-MM-dd")] || []).length > 3 && (
                                <span className="text-xs text-muted-foreground">+</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          {dayPosts.slice(0, 3).map(post => {
                            const isPending = post.status === 'scheduled_pending';
                            const platforms = (post as any).platforms;
                            const isMultiPlatform = Array.isArray(platforms) && platforms.length > 1;
                            
                            // For multi-platform posts, show the first platform icon
                            const displayPlatform = (isMultiPlatform ? platforms[0].provider : post.platform) as Platform;
                            const Icon = platformIcons[displayPlatform] || platformIcons.instagram;
                            const platformColor = platformColors[displayPlatform] || platformColors.instagram;
                            
                            // Format time and date
                            const scheduledTime = post.scheduledAt ? format(new Date(post.scheduledAt), "h:mm a") : "";
                            const tone = (post as any).tone;
                            
                            return (
                              <div
                                key={post.id}
                                className={`text-xs p-1 sm:p-2 rounded cursor-pointer transition-all hover:shadow-md border ${
                                  isPending 
                                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600'
                                    : `bg-card border-border`
                                }`}
                                title={post.caption}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  
                                  // Use new drawer for editing if feature enabled
                                  if (scheduleUIEnabled) {
                                    setDrawerDate(post.scheduledAt ? new Date(post.scheduledAt) : new Date());
                                    setDrawerMode('edit');
                                    setDrawerScheduleId(post.id);
                                    setDrawerOpen(true);
                                    return;
                                  }
                                  
                                  // Fetch full post details (legacy behavior)
                                  try {
                                    const details = await apiRequest("GET", `/api/schedule/${post.id}`);
                                    setPostDetails(details);
                                    setSelectedPost(post);
                                    setActiveTab("preview"); // Default to preview tab
                                    setCaptionExpanded(false);
                                    setResolveDialogOpen(true);
                                  } catch (error) {
                                    // Fallback to current behavior if fetch fails
                                    console.error("Failed to fetch post details:", error);
                                    toast({
                                      title: "Could not load post details",
                                      description: "Showing basic view instead",
                                      variant: "destructive",
                                    });
                                    setSelectedPost(post);
                                    setPostDetails(null);
                                    setActiveTab(isPending ? "resolve" : "preview");
                                    setResolveDialogOpen(true);
                                  }
                                }}
                                data-testid={`post-${post.id}`}
                              >
                                {/* Header row with time, icon, and status */}
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1">
                                    {isPending && <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />}
                                    <Icon className={`h-3 w-3 ${isPending ? 'text-yellow-600 dark:text-yellow-400' : platformColor.replace('bg-', 'text-').replace(/\/\d+/, '')}`} />
                                    {scheduledTime && (
                                      <span className="font-medium text-foreground">{scheduledTime}</span>
                                    )}
                                  </div>
                                  {isMultiPlatform && (
                                    <span className="text-xs text-muted-foreground">+{platforms.length - 1}</span>
                                  )}
                                </div>
                                
                                {/* Tone badge if available */}
                                {tone && (
                                  <div className="mb-1">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary capitalize">
                                      {tone}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Caption */}
                                <p className="text-muted-foreground line-clamp-2 leading-tight">
                                  {post.caption.substring(0, 60)}{post.caption.length > 60 ? '...' : ''}
                                </p>
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
      
      {/* Interactive Schedule Drawer (feature-flagged) */}
      {scheduleUIEnabled && (
        <ScheduleDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedDate={drawerDate}
          mode={drawerMode}
          scheduleId={drawerScheduleId}
        />
      )}
    </div>
  );
}
