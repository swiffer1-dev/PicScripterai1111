import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Send } from "lucide-react";
import type { Connection, Platform } from "@shared/schema";

const postSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "facebook"]),
  caption: z.string().min(1, "Caption is required").max(2200, "Caption is too long"),
  mediaType: z.enum(["image", "video"]).optional(),
  mediaUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  scheduledAt: z.string().optional().or(z.literal("")),
});

type PostForm = z.infer<typeof postSchema>;

const platformCharLimits: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  twitter: 280,
  linkedin: 3000,
  pinterest: 500,
  youtube: 5000,
  facebook: 63206,
};

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isScheduled, setIsScheduled] = useState(false);

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const form = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      platform: connections?.[0]?.platform as Platform || "instagram",
      caption: "",
      mediaType: "image",
      mediaUrl: "",
      scheduledAt: "",
    },
  });

  const selectedPlatform = form.watch("platform");
  const caption = form.watch("caption");
  const charLimit = platformCharLimits[selectedPlatform] || 2200;

  const createPostMutation = useMutation({
    mutationFn: async (data: PostForm) => {
      const endpoint = isScheduled && data.scheduledAt ? "/api/schedule" : "/api/posts";
      const payload: any = {
        platform: data.platform,
        caption: data.caption,
      };

      if (data.mediaUrl && data.mediaType) {
        payload.media = {
          type: data.mediaType,
          url: data.mediaUrl,
        };
      }

      if (isScheduled && data.scheduledAt) {
        payload.scheduledAtISO = data.scheduledAt;
      }

      return await apiRequest("POST", endpoint, payload);
    },
    onSuccess: () => {
      toast({
        title: isScheduled ? "Post scheduled!" : "Post published!",
        description: isScheduled 
          ? "Your post has been scheduled successfully."
          : "Your post has been queued for publishing.",
      });
      setLocation("/posts");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PostForm) => {
    createPostMutation.mutate(data);
  };

  const connectedPlatforms = connections?.map(c => c.platform) || [];

  if (connections && connections.length === 0) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>No connections</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                You need to connect at least one platform before creating posts.
              </p>
              <Button onClick={() => setLocation("/connections")} data-testid="button-go-to-connections">
                Connect a platform
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Create Post</h1>
            <p className="text-muted-foreground mt-1.5">Compose and publish your social media content</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={form.watch("platform")}
                    onValueChange={(value) => form.setValue("platform", value as Platform)}
                  >
                    <SelectTrigger id="platform" data-testid="select-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedPlatforms.map((platform) => (
                        <SelectItem key={platform} value={platform} data-testid={`option-platform-${platform}`}>
                          <span className="capitalize">{platform}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caption">Caption</Label>
                  <Textarea
                    id="caption"
                    placeholder="What's on your mind?"
                    className="min-h-32 resize-none"
                    data-testid="textarea-caption"
                    {...form.register("caption")}
                  />
                  <div className="flex justify-between items-center">
                    {form.formState.errors.caption && (
                      <p className="text-sm text-destructive">{form.formState.errors.caption.message}</p>
                    )}
                    <div className="ml-auto">
                      <span className={`text-xs ${caption.length > charLimit ? "text-destructive" : "text-muted-foreground"}`}>
                        {caption.length} / {charLimit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mediaType">Media Type</Label>
                    <Select
                      value={form.watch("mediaType")}
                      onValueChange={(value) => form.setValue("mediaType", value as "image" | "video")}
                    >
                      <SelectTrigger id="mediaType" data-testid="select-media-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mediaUrl">Media URL</Label>
                    <Input
                      id="mediaUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      data-testid="input-media-url"
                      {...form.register("mediaUrl")}
                    />
                  </div>
                </div>

                {form.formState.errors.mediaUrl && (
                  <p className="text-sm text-destructive">{form.formState.errors.mediaUrl.message}</p>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedule"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded border-input"
                      data-testid="checkbox-schedule"
                    />
                    <Label htmlFor="schedule" className="cursor-pointer">Schedule for later</Label>
                  </div>

                  {isScheduled && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduledAt">Schedule Date & Time</Label>
                      <Input
                        id="scheduledAt"
                        type="datetime-local"
                        data-testid="input-scheduled-at"
                        {...form.register("scheduledAt")}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/posts")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createPostMutation.isPending}
                    data-testid="button-submit-post"
                  >
                    {createPostMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isScheduled ? "Scheduling..." : "Publishing..."}
                      </>
                    ) : (
                      <>
                        {isScheduled ? (
                          <>
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Post
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Publish Now
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
