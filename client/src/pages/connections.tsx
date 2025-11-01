import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink } from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiLinkedin, SiPinterest, SiYoutube, SiFacebook } from "react-icons/si";
import type { Connection, Platform } from "@shared/schema";

const platformIcons = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  twitter: SiX,
  linkedin: SiLinkedin,
  pinterest: SiPinterest,
  youtube: SiYoutube,
  facebook: SiFacebook,
};

const platformColors = {
  instagram: "from-purple-500 to-pink-500",
  tiktok: "from-black to-cyan-400",
  twitter: "from-blue-400 to-blue-600",
  linkedin: "from-blue-600 to-blue-800",
  pinterest: "from-red-600 to-red-800",
  youtube: "from-red-500 to-red-700",
  facebook: "from-blue-500 to-blue-700",
};

const allPlatforms: Platform[] = [
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "pinterest",
  "youtube",
  "facebook",
];

export default function Connections() {
  const { toast } = useToast();
  
  const { data: connections, isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      const response = await apiRequest("GET", `/api/connect/${platform}`);
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      return await apiRequest("POST", `/api/disconnect/${platform}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Disconnected",
        description: "Platform connection removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const connectedPlatforms = new Set(connections?.map(c => c.platform) || []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Connections</h1>
            <p className="text-muted-foreground mt-1.5">Manage your social media platform connections</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(7)].map((_, i) => (
                <Card key={i} className="border-border animate-pulse">
                  <CardHeader>
                    <div className="h-12 w-12 bg-muted rounded-lg mb-4"></div>
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {allPlatforms.map((platform) => {
                const Icon = platformIcons[platform];
                const connection = connections?.find(c => c.platform === platform);
                const isConnected = connectedPlatforms.has(platform);

                return (
                  <Card key={platform} className="border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${platformColors[platform]} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-lg font-semibold capitalize">
                        {platform}
                      </CardTitle>
                      <CardDescription>
                        {isConnected ? (
                          <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400"></span>
                            Connected
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not connected</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isConnected && connection ? (
                        <div className="space-y-4">
                          {connection.accountHandle && (
                            <p className="text-sm text-muted-foreground truncate">
                              @{connection.accountHandle}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Connected {new Date(connection.createdAt).toLocaleDateString()}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => disconnectMutation.mutate(platform)}
                            disabled={disconnectMutation.isPending}
                            data-testid={`button-disconnect-${platform}`}
                          >
                            {disconnectMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Disconnecting...
                              </>
                            ) : (
                              "Disconnect"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => connectMutation.mutate(platform)}
                          disabled={connectMutation.isPending}
                          data-testid={`button-connect-${platform}`}
                        >
                          {connectMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Connect
                            </>
                          )}
                        </Button>
                      )}
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
