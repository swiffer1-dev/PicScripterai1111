import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Menu, Calendar as CalendarIcon, Plus, X } from "lucide-react";
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
  const featureEnabled = import.meta.env.VITE_FEATURE_SCHEDULE_PENDING === "true";
  const { toast } = useToast();

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
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
      const payload: any = {
        platform: data.platform,
        caption: data.caption,
        scheduledAtISO: data.scheduledAt,
      };

      if (data.imageUrl) {
        payload.media = {
          type: "image",
          url: data.imageUrl,
        };
      }

      // Add Pinterest-specific options
      if (data.platform === "pinterest") {
        // Fetch Pinterest boards
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
      setScheduleDialogOpen(false);
      setScheduleData(null);
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

    const charLimit = platformCharLimits[scheduleData.platform];
    if (scheduleData.caption.length > charLimit) {
      toast({
        title: "Caption too long",
        description: `${scheduleData.platform} has a ${charLimit} character limit. Current: ${scheduleData.caption.length}`,
        variant: "destructive",
      });
      return;
    }

    schedulePostMutation.mutate(scheduleData);
  };

  return (
    <div className="flex h-screen bg-background">
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
                            const Icon = platformIcons[post.platform];
                            return (
                              <div
                                key={post.id}
                                className={`text-xs p-1.5 rounded text-white ${platformColors[post.platform]} flex items-center gap-1 truncate`}
                                title={post.caption}
                                data-testid={`post-${post.id}`}
                              >
                                <Icon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{post.caption.substring(0, 20)}...</span>
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
