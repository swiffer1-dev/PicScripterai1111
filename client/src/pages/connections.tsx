import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Menu, Store, RefreshCw } from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiLinkedin, SiPinterest, SiYoutube, SiFacebook, SiShopify, SiEtsy, SiSquarespace } from "react-icons/si";
import type { Connection, Platform, EcommerceConnection, EcommercePlatform } from "@shared/schema";
import { useState } from "react";
import logoImage from "@assets/3b7202e2-9203-4af9-8c28-e5e0face0c49_1762309431850.png";

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

const ecommercePlatformIcons = {
  shopify: SiShopify,
  etsy: SiEtsy,
  squarespace: SiSquarespace,
};

const ecommercePlatformColors = {
  shopify: "from-green-500 to-green-700",
  etsy: "from-orange-500 to-orange-700",
  squarespace: "from-black to-gray-700",
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

const allEcommercePlatforms: EcommercePlatform[] = [
  "shopify",
  "etsy",
  "squarespace",
];

export default function Connections() {
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  
  const { data: connections, isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: ecommerceConnections, isLoading: isLoadingEcommerce } = useQuery<EcommerceConnection[]>({
    queryKey: ["/api/ecommerce/connections"],
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

  const ecommerceConnectMutation = useMutation({
    mutationFn: async ({ platform, shopDomain }: { platform: EcommercePlatform; shopDomain?: string }) => {
      const params = shopDomain ? `?shopDomain=${encodeURIComponent(shopDomain)}` : "";
      const response = await apiRequest("GET", `/api/ecommerce/connect/${platform}${params}`);
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

  const ecommerceDisconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest("DELETE", `/api/ecommerce/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      toast({
        title: "Disconnected",
        description: "E-commerce connection removed successfully",
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

  const syncProductsMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest("POST", `/api/ecommerce/products/sync/${connectionId}`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products synced",
        description: `Synced ${data.count} products successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const connectedPlatforms = new Set(connections?.map(c => c.platform) || []);
  const connectedEcommercePlatforms = new Set(ecommerceConnections?.map(c => c.platform) || []);

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
            className="h-7 w-auto object-contain"
            data-testid="img-logo-mobile-connections"
          />
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8 hidden lg:block">
            <h1 className="text-3xl font-semibold tracking-tight">Connections</h1>
            <p className="text-muted-foreground mt-1.5">Manage your social media and e-commerce platform connections</p>
          </div>

          {/* Social Media Platforms Section */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Social Media Platforms</h2>

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

          {/* E-commerce Platforms Section */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">E-commerce Platforms</h2>
            {isLoadingEcommerce ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
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
                {allEcommercePlatforms.map((platform) => {
                  const Icon = ecommercePlatformIcons[platform];
                  const connection = ecommerceConnections?.find(c => c.platform === platform);
                  const isConnected = connectedEcommercePlatforms.has(platform);

                  return (
                    <Card key={platform} className="border-border shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${ecommercePlatformColors[platform]} flex items-center justify-center mb-4`}>
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
                          <div className="space-y-3">
                            {connection.storeName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Store className="h-4 w-4" />
                                <span className="truncate">{connection.storeName}</span>
                              </div>
                            )}
                            {connection.lastSyncedAt && (
                              <p className="text-xs text-muted-foreground">
                                Last synced {new Date(connection.lastSyncedAt).toLocaleDateString()}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Connected {new Date(connection.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => syncProductsMutation.mutate(connection.id)}
                                disabled={syncProductsMutation.isPending}
                                data-testid={`button-sync-${platform}`}
                              >
                                {syncProductsMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Syncing...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-3 w-3" />
                                    Sync
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => ecommerceDisconnectMutation.mutate(connection.id)}
                                disabled={ecommerceDisconnectMutation.isPending}
                                data-testid={`button-disconnect-ecommerce-${platform}`}
                              >
                                {ecommerceDisconnectMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Disconnecting...
                                  </>
                                ) : (
                                  "Disconnect"
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {platform === "shopify" && (
                              <Input
                                placeholder="yourstore.myshopify.com"
                                value={shopDomain}
                                onChange={(e) => setShopDomain(e.target.value)}
                                data-testid="input-shop-domain"
                              />
                            )}
                            <Button
                              className="w-full"
                              onClick={() => ecommerceConnectMutation.mutate({ platform, shopDomain: platform === "shopify" ? shopDomain : undefined })}
                              disabled={ecommerceConnectMutation.isPending || (platform === "shopify" && !shopDomain)}
                              data-testid={`button-connect-ecommerce-${platform}`}
                            >
                              {ecommerceConnectMutation.isPending ? (
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
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
