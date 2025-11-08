import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Instagram, Send, Twitter, Linkedin, Youtube, Facebook, AlertCircle } from "lucide-react";
import { SiPinterest, SiTiktok } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Platform = "instagram" | "tiktok" | "twitter" | "linkedin" | "pinterest" | "youtube" | "facebook";

interface ScheduleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  mode?: 'create' | 'edit';
  scheduleId?: string;
}

const platformIcons: Record<Platform, any> = {
  instagram: Instagram,
  tiktok: SiTiktok,
  twitter: Twitter,
  linkedin: Linkedin,
  pinterest: SiPinterest,
  youtube: Youtube,
  facebook: Facebook,
};

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  youtube: "YouTube",
  facebook: "Facebook",
};

export function ScheduleDrawer({ isOpen, onClose, selectedDate, mode = 'create', scheduleId }: ScheduleDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");
  
  // Get connections to show which platforms are connected
  const { data: connections } = useQuery<any[]>({
    queryKey: ["/api/connections"],
  });
  
  // Fetch existing post data when in edit mode
  const { data: existingPost, isLoading: isLoadingPost } = useQuery<any>({
    queryKey: ["/api/schedule", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      return await apiRequest("GET", `/api/schedule/${scheduleId}`);
    },
    enabled: isOpen && mode === 'edit' && !!scheduleId,
  });
  
  // Reset form helper
  const resetForm = () => {
    setCaption("");
    setImageUrl("");
    setSelectedPlatforms([]);
    setValidationErrors([]);
  };
  
  // Update scheduled time when selectedDate or isOpen changes (create mode)
  useEffect(() => {
    if (isOpen && mode === 'create') {
      const defaultTime = new Date(selectedDate);
      defaultTime.setHours(10, 0, 0, 0);
      setScheduledTime(format(defaultTime, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, isOpen, mode]);
  
  // Reset form when mode or scheduleId changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create' || !scheduleId) {
        resetForm();
      }
    }
  }, [mode, scheduleId, isOpen]);
  
  // Prefill form when editing
  useEffect(() => {
    if (mode === 'edit' && existingPost) {
      setCaption(existingPost.caption || "");
      setImageUrl(existingPost.media?.[0]?.url || "");
      setScheduledTime(existingPost.scheduledAt ? format(new Date(existingPost.scheduledAt), "yyyy-MM-dd'T'HH:mm") : "");
      
      // Extract platform providers
      const platforms = (existingPost.platforms || []).map((p: any) => 
        typeof p === 'string' ? p : p.provider
      );
      setSelectedPlatforms(platforms);
    }
  }, [mode, existingPost]);
  
  const schedulePostMutation = useMutation({
    mutationFn: async () => {
      const scheduledAtISO = new Date(scheduledTime).toISOString();
      
      const payload: any = {
        platforms: selectedPlatforms.map(p => ({ provider: p })),
        caption,
        scheduledAt: scheduledAtISO,
      };
      
      if (imageUrl.trim()) {
        payload.media = {
          type: "image",
          url: imageUrl.trim(),
        };
      }
      
      return await apiRequest("POST", "/api/schedule", payload);
    },
    onSuccess: (data: any) => {
      const status = data.status || "scheduled";
      const statusLabel = status === "scheduled_pending" ? "Pending" : "Scheduled";
      
      toast({
        title: `Post ${statusLabel}!`,
        description: `Your post has been ${statusLabel.toLowerCase()} successfully`,
      });
      
      // Refetch calendar data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/calendar";
        }
      });
      
      // Reset and close
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to schedule post";
      
      // Try to parse validation errors if present
      if (error.message && error.message.includes("validation")) {
        setValidationErrors([errorMessage]);
      } else {
        toast({
          title: "Failed to schedule",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });
  
  const updatePostMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("No schedule ID");
      
      const payload: any = {
        platforms: selectedPlatforms.map(p => ({ provider: p })),
        caption,
      };
      
      // Only include scheduledAt if it's a valid datetime
      if (scheduledTime && scheduledTime.trim()) {
        try {
          const scheduledAtISO = new Date(scheduledTime).toISOString();
          payload.scheduledAt = scheduledAtISO;
        } catch (error) {
          // Invalid date, don't include scheduledAt
          console.warn("Invalid scheduledTime:", scheduledTime);
        }
      }
      
      if (imageUrl.trim()) {
        payload.media = {
          type: "image",
          url: imageUrl.trim(),
        };
      }
      
      return await apiRequest("PATCH", `/api/schedule/${scheduleId}`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Post updated!",
        description: "Your scheduled post has been updated successfully",
      });
      
      // Refetch calendar data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/calendar";
        }
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Failed to update post",
        variant: "destructive",
      });
    },
  });
  
  const duplicatePostMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("No schedule ID");
      return await apiRequest("POST", `/api/schedule/${scheduleId}/duplicate`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Post duplicated!",
        description: "A new draft has been created",
      });
      
      // Refetch calendar data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/calendar";
        }
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to duplicate",
        description: error.message || "Failed to duplicate post",
        variant: "destructive",
      });
    },
  });
  
  const handleSchedule = () => {
    setValidationErrors([]);
    
    if (!caption.trim()) {
      setValidationErrors(["Caption is required"]);
      return;
    }
    
    if (selectedPlatforms.length === 0) {
      setValidationErrors(["Please select at least one platform"]);
      return;
    }
    
    if (mode === 'edit') {
      updatePostMutation.mutate();
    } else {
      schedulePostMutation.mutate();
    }
  };
  
  const handleSaveAsPending = () => {
    setValidationErrors([]);
    
    if (!caption.trim()) {
      setValidationErrors(["Caption is required"]);
      return;
    }
    
    // Allow saving with 0 platforms - backend will mark as pending
    if (mode === 'edit') {
      updatePostMutation.mutate();
    } else {
      schedulePostMutation.mutate();
    }
  };
  
  const handleDuplicate = () => {
    duplicatePostMutation.mutate();
  };
  
  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };
  
  if (!isOpen) return null;
  
  const connectedPlatforms = new Set(
    connections?.map((c: any) => c.platform) || []
  );
  
  const hasUnconnectedPlatforms = selectedPlatforms.some(
    p => !connectedPlatforms.has(p)
  );
  
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        data-testid="drawer-backdrop"
      />
      
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-[500px] bg-background border-l border-border z-50 overflow-y-auto shadow-2xl"
        data-testid="schedule-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{mode === 'edit' ? 'Edit Schedule' : 'Schedule Post'}</h2>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "MMMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-drawer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Validation Errors:</p>
                <ul className="mt-1 text-sm text-destructive/90 list-disc list-inside">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Caption */}
          <div>
            <Label htmlFor="drawer-caption">Caption</Label>
            <Textarea
              id="drawer-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              className="mt-2 min-h-[150px]"
              data-testid="input-drawer-caption"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {caption.length} characters
            </p>
          </div>
          
          {/* Image URL */}
          <div>
            <Label htmlFor="drawer-image-url">Image URL (Optional)</Label>
            <Input
              id="drawer-image-url"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="mt-2"
              data-testid="input-drawer-image-url"
            />
          </div>
          
          {/* Scheduled Time */}
          <div>
            <Label htmlFor="drawer-scheduled-time">Scheduled Date & Time</Label>
            <Input
              id="drawer-scheduled-time"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="mt-2"
              data-testid="input-drawer-scheduled-time"
            />
          </div>
          
          {/* Platforms */}
          <div>
            <Label>Platforms</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {(Object.keys(platformIcons) as Platform[]).map((platform) => {
                const Icon = platformIcons[platform];
                const isSelected = selectedPlatforms.includes(platform);
                const isConnected = connectedPlatforms.has(platform);
                
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`drawer-platform-${platform}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {isSelected && (
                        <div className="w-2 h-2 bg-primary-foreground rounded-sm" />
                      )}
                    </div>
                    <Icon className="h-4 w-4" />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium">{platformLabels[platform]}</span>
                      {!isConnected && (
                        <span className="text-xs text-muted-foreground block">Not connected</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {hasUnconnectedPlatforms && (
              <p className="text-xs text-muted-foreground mt-2">
                Some selected platforms are not connected. You can save as pending.
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4">
          {mode === 'create' ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSaveAsPending}
                disabled={schedulePostMutation.isPending}
                className="flex-1"
                data-testid="button-save-pending"
              >
                {schedulePostMutation.isPending ? "Saving..." : "Save as Pending"}
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={schedulePostMutation.isPending || selectedPlatforms.length === 0}
                className="flex-1"
                data-testid="button-schedule-drawer"
              >
                <Send className="h-4 w-4 mr-2" />
                {schedulePostMutation.isPending ? "Scheduling..." : "Schedule"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleSchedule}
                  disabled={updatePostMutation.isPending || selectedPlatforms.length === 0}
                  className="flex-1"
                  data-testid="button-update-schedule"
                >
                  {updatePostMutation.isPending ? "Updating..." : "Update & Retry"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={duplicatePostMutation.isPending}
                  data-testid="button-duplicate-schedule"
                >
                  {duplicatePostMutation.isPending ? "Duplicating..." : "Duplicate"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
