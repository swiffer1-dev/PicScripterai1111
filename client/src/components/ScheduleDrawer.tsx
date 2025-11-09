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
import ImageUploader from "@/components/ImageUploader";

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

interface SchedulePreviewProps {
  mediaUrl?: string;
  category?: string;
  tone?: string;
  caption: string;
  platforms: Platform[];
  scheduledAt: string;
  onEditClick: () => void;
}

function SchedulePreview({ mediaUrl, category, tone, caption, platforms, scheduledAt, onEditClick }: SchedulePreviewProps) {
  const formattedDate = scheduledAt 
    ? format(new Date(scheduledAt), "EEEE, MMM d • h:mm a")
    : "Not scheduled";
  
  return (
    <div className="p-4 space-y-6">
      {/* Image Preview */}
      {mediaUrl && (
        <div className="rounded-lg overflow-hidden border border-border">
          <img 
            src={mediaUrl} 
            alt="Post preview" 
            className="w-full h-auto object-cover"
            data-testid="preview-image"
          />
        </div>
      )}
      
      {/* Badges Row */}
      {(category || tone) && (
        <div className="flex gap-2 flex-wrap">
          {category && (
            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium" data-testid="preview-category-badge">
              {category}
            </div>
          )}
          {tone && (
            <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-medium" data-testid="preview-tone-badge">
              {tone}
            </div>
          )}
        </div>
      )}
      
      {/* Caption */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Caption</h3>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="preview-caption">
          {caption}
        </p>
      </div>
      
      {/* Platforms */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Publishing to</h3>
        <div className="flex gap-2 flex-wrap">
          {platforms.map((platform) => {
            const Icon = platformIcons[platform];
            return (
              <div 
                key={platform} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50"
                data-testid={`preview-platform-${platform}`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{platformLabels[platform]}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Scheduled Time */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Scheduled for</h3>
        <p className="text-sm font-medium" data-testid="preview-scheduled-time">
          {formattedDate}
        </p>
      </div>
      
      {/* Edit Button */}
      <Button 
        onClick={onEditClick} 
        className="w-full"
        data-testid="button-edit-post"
      >
        Edit Post
      </Button>
    </div>
  );
}

export function ScheduleDrawer({ isOpen, onClose, selectedDate, mode = 'create', scheduleId }: ScheduleDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // View mode: preview (read-only) or edit (form fields)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>(mode === 'create' ? 'edit' : 'preview');
  
  // Form state
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
      const res = await apiRequest("GET", `/api/schedule/${scheduleId}`);
      return await res.json();
    },
    enabled: isOpen && mode === 'edit' && !!scheduleId,
  });
  
  // Upload mutation for images
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File): Promise<string> => {
      // Get presigned URL from backend
      const res = await apiRequest("POST", "/api/upload/image");
      const response = await res.json() as { uploadURL: string; objectPath: string };
      
      // Upload file directly to object storage
      const uploadResponse = await fetch(response.uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }
      
      // Return the object path
      return response.objectPath;
    },
    onError: (error: any) => {
      toast({
        title: "Image upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Reset form helper
  const resetForm = () => {
    setCaption("");
    setImageUrl("");
    setImageFile(null);
    setImagePreviewUrl("");
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
        setViewMode('edit'); // Create mode starts in edit
      } else {
        setViewMode('preview'); // Edit mode starts in preview
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
  
  // Check for draft data from AI Studio when drawer opens in create mode
  useEffect(() => {
    if (isOpen && mode === 'create') {
      const draftData = sessionStorage.getItem('schedule-draft-data');
      if (draftData) {
        try {
          const parsed = JSON.parse(draftData);
          if (parsed.caption) {
            setCaption(parsed.caption);
          }
          if (parsed.imageUrl) {
            setImageUrl(parsed.imageUrl);
          }
          if (parsed.scheduledAt) {
            setScheduledTime(parsed.scheduledAt);
          }
          
          // Pre-select platforms: use provided platforms or default to first connected platform
          if (parsed.platforms && Array.isArray(parsed.platforms) && parsed.platforms.length > 0) {
            setSelectedPlatforms(parsed.platforms);
          } else if (connections && connections.length > 0) {
            // Default to first connected platform if no platforms specified
            setSelectedPlatforms([connections[0].platform]);
          }
          
          // Clear the draft data after loading it
          sessionStorage.removeItem('schedule-draft-data');
        } catch (error) {
          console.error('Failed to parse draft data:', error);
        }
      }
    }
  }, [isOpen, mode, connections]);
  
  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);
  
  const schedulePostMutation = useMutation({
    mutationFn: async () => {
      // Upload image first if there's a file
      let finalImageUrl = imageUrl;
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          finalImageUrl = await uploadImageMutation.mutateAsync(imageFile);
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      const scheduledAtISO = new Date(scheduledTime).toISOString();
      
      const payload: any = {
        platforms: selectedPlatforms.map(p => ({ provider: p })),
        caption,
        scheduledAt: scheduledAtISO,
      };
      
      if (finalImageUrl && finalImageUrl.trim()) {
        payload.media = {
          type: "image",
          url: finalImageUrl.trim(),
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
      
      // Upload image first if there's a new file
      let finalImageUrl = imageUrl;
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          finalImageUrl = await uploadImageMutation.mutateAsync(imageFile);
        } finally {
          setIsUploadingImage(false);
        }
      }
      
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
      
      if (finalImageUrl && finalImageUrl.trim()) {
        payload.media = {
          type: "image",
          url: finalImageUrl.trim(),
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
    // Guard against concurrent mutations
    if (isUploadingImage || schedulePostMutation.isPending || updatePostMutation.isPending) {
      return;
    }
    
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
    // Guard against concurrent mutations
    if (isUploadingImage || schedulePostMutation.isPending || updatePostMutation.isPending) {
      return;
    }
    
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
    // Guard against concurrent mutations
    if (isUploadingImage || duplicatePostMutation.isPending) {
      return;
    }
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
            <h2 className="text-lg font-semibold">
              {viewMode === 'preview' ? 'Post Preview' : mode === 'edit' ? 'Edit Schedule' : 'Schedule Post'}
            </h2>
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
        {viewMode === 'preview' && mode === 'edit' && existingPost ? (
          <SchedulePreview 
            mediaUrl={existingPost.media?.[0]?.url}
            category={existingPost.category}
            tone={existingPost.tone}
            caption={existingPost.caption || ""}
            platforms={(existingPost.platforms || []).map((p: any) => 
              typeof p === 'string' ? p : p.provider
            )}
            scheduledAt={existingPost.scheduledAt || ""}
            onEditClick={() => setViewMode('edit')}
          />
        ) : (
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
          
          {/* Image Upload */}
          <div>
            <Label>Image (Optional)</Label>
            <div className="mt-2 h-64">
              <ImageUploader
                onImageChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    const file = files[0]; // Only take first file for scheduling
                    setImageFile(file);
                    const previewUrl = URL.createObjectURL(file);
                    setImagePreviewUrl(previewUrl);
                    // Clear any existing URL
                    setImageUrl("");
                  }
                }}
                previewUrls={imagePreviewUrl ? [imagePreviewUrl] : (imageUrl ? [imageUrl] : [])}
                isLoading={isUploadingImage}
                onClearImages={() => {
                  setImageFile(null);
                  setImagePreviewUrl("");
                  setImageUrl("");
                }}
                onDeleteImage={() => {
                  setImageFile(null);
                  setImagePreviewUrl("");
                  setImageUrl("");
                }}
                onReorderImages={() => {}} // Not needed for single image
              />
            </div>
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
        )}
        
        {/* Footer - Only show in edit mode since preview has its own Edit button */}
        {viewMode === 'edit' && (
        <div className="sticky bottom-0 bg-background border-t border-border p-4 mt-auto">
          {mode === 'create' ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSaveAsPending}
                disabled={schedulePostMutation.isPending || isUploadingImage}
                className="flex-1"
                data-testid="button-save-pending"
              >
                {isUploadingImage ? "Uploading..." : schedulePostMutation.isPending ? "Saving..." : "Save as Pending"}
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={schedulePostMutation.isPending || isUploadingImage || selectedPlatforms.length === 0}
                className="flex-1"
                data-testid="button-schedule-drawer"
              >
                <Send className="h-4 w-4 mr-2" />
                {isUploadingImage ? "Uploading..." : schedulePostMutation.isPending ? "Scheduling..." : "Schedule"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleSchedule}
                  disabled={updatePostMutation.isPending || isUploadingImage || selectedPlatforms.length === 0}
                  className="flex-1"
                  data-testid="button-update-schedule"
                >
                  {isUploadingImage ? "Uploading..." : updatePostMutation.isPending ? "Updating..." : "Update & Retry"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={duplicatePostMutation.isPending || isUploadingImage}
                  data-testid="button-duplicate-schedule"
                >
                  {duplicatePostMutation.isPending ? "Duplicating..." : "Duplicate"}
                </Button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </>
  );
}
