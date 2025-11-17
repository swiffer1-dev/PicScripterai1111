import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, Plus, Trash2, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/sidebar';
import CategorySelector from '../components/CategorySelector';
import { Category, Tone } from '../types/ai-studio';
import { Platform } from '@shared/schema';
import logoImage from '@assets/logo.png';
import { apiRequest } from '@/lib/queryClient';

interface BatchItem {
  id: string;
  title: string;
  details: string;
  price: string;
  location: string;
  mediaUrls: string;
  platforms: Platform[];
  action: 'description_only' | 'post_now' | 'schedule';
  scheduledAt: string;
  generatedDescription?: string;
  status?: 'pending' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
}

export default function BatchMode() {
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [category, setCategory] = useState<Category>(Category.Ecommerce);
  const [tone, setTone] = useState<Tone>('Authentic');
  const [items, setItems] = useState<BatchItem[]>([
    {
      id: '1',
      title: '',
      details: '',
      price: '',
      location: '',
      mediaUrls: '',
      platforms: [],
      action: 'description_only',
      scheduledAt: '',
      status: 'pending',
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: connections } = useQuery<any[]>({
    queryKey: ["/api/connections"],
  });

  const connectedPlatforms = new Set(connections?.map((c) => c.platform) || []);

  const addRow = () => {
    if (items.length >= 20) {
      toast({
        title: "Maximum rows reached",
        description: "You can only process 20 items per batch",
        variant: "destructive",
      });
      return;
    }

    setItems([
      ...items,
      {
        id: Date.now().toString(),
        title: '',
        details: '',
        price: '',
        location: '',
        mediaUrls: '',
        platforms: [],
        action: 'description_only',
        scheduledAt: '',
        status: 'pending',
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (items.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one item is required",
        variant: "destructive",
      });
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof BatchItem, value: any) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const togglePlatform = (itemId: string, platform: Platform) => {
    setItems(items.map((item) => {
      if (item.id === itemId) {
        const platforms = item.platforms.includes(platform)
          ? item.platforms.filter((p) => p !== platform)
          : [...item.platforms, platform];
        return { ...item, platforms };
      }
      return item;
    }));
  };

  const validateItems = (): boolean => {
    for (const item of items) {
      if (!item.title.trim()) {
        toast({
          title: "Validation Error",
          description: "All items must have a title",
          variant: "destructive",
        });
        return false;
      }
      if (!item.details.trim()) {
        toast({
          title: "Validation Error",
          description: "All items must have details",
          variant: "destructive",
        });
        return false;
      }
      if (item.action === 'schedule' && !item.scheduledAt) {
        toast({
          title: "Validation Error",
          description: "Scheduled posts must have a scheduled date/time",
          variant: "destructive",
        });
        return false;
      }
      if ((item.action === 'post_now' || item.action === 'schedule') && item.platforms.length === 0) {
        toast({
          title: "Validation Error",
          description: "Posts must have at least one platform selected",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleGenerateBatch = async () => {
    if (!validateItems()) {
      return;
    }

    setIsGenerating(true);
    
    // Mark all items as generating
    setItems(items.map(item => ({ ...item, status: 'generating' as const })));

    try {
      const response = await apiRequest("POST", "/api/batch", {
        category,
        tone,
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          details: item.details,
          price: item.price,
          location: item.location,
          mediaUrls: item.mediaUrls.split(',').map(url => url.trim()).filter(Boolean),
          platforms: item.platforms,
          action: item.action,
          scheduledAt: item.scheduledAt,
        })),
      });

      const result = await response.json();

      if (result.results) {
        setItems(items.map(item => {
          const resultItem = result.results.find((r: any) => r.id === item.id);
          if (resultItem) {
            return {
              ...item,
              generatedDescription: resultItem.description,
              status: resultItem.status === 'success' ? 'completed' : 'error',
              errorMessage: resultItem.errorMessage,
            };
          }
          return item;
        }));

        const successCount = result.results.filter((r: any) => r.status === 'success').length;
        const errorCount = result.results.filter((r: any) => r.status === 'error').length;

        toast({
          title: "Batch generation completed",
          description: `${successCount} succeeded, ${errorCount} failed`,
        });
      }
    } catch (error: any) {
      console.error("Batch generation error:", error);
      toast({
        title: "Batch generation failed",
        description: error.message || "An error occurred during batch generation",
        variant: "destructive",
      });
      
      // Reset all items to pending
      setItems(items.map(item => ({ ...item, status: 'pending' as const })));
    } finally {
      setIsGenerating(false);
    }
  };

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
            data-testid="img-logo-mobile-batch"
          />
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight">Batch Mode</h1>
              <p className="text-muted-foreground mt-1.5">
                Generate descriptions for multiple products/posts at once
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Settings Card */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Batch Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Category
                  </label>
                  <CategorySelector
                    selectedCategory={category}
                    onCategoryChange={setCategory}
                    isDisabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="batch-tone-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Tone
                  </label>
                  <select
                    id="batch-tone-select"
                    value={tone}
                    onChange={e => setTone(e.target.value as Tone)}
                    disabled={isGenerating}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm disabled:opacity-50"
                    data-testid="select-batch-tone"
                  >
                    <optgroup label="🤖 AI-Proof Tones">
                      <option value="Authentic">Authentic</option>
                      <option value="Conversational">Conversational</option>
                      <option value="SEO Boosted">SEO Boosted</option>
                    </optgroup>
                    <optgroup label="Classic Tones">
                      <option value="Professional">Professional</option>
                      <option value="Casual">Casual</option>
                      <option value="Luxury">Luxury</option>
                      <option value="Playful">Playful</option>
                      <option value="Motivational">Motivational</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Items ({items.length}/20)</h2>
                <Button
                  onClick={addRow}
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || items.length >= 20}
                  className="gap-2"
                  data-testid="button-add-row"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">#</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground min-w-[150px]">Title</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground min-w-[200px]">Details</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Price</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Location</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Media URLs</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Platforms</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Action</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground min-w-[180px]">Scheduled At</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground min-w-[300px]">Generated Description</th>
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-border" data-testid={`batch-row-${item.id}`}>
                        <td className="p-2 text-sm">{index + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                            disabled={isGenerating}
                            placeholder="Product title"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                            data-testid={`input-title-${item.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            value={item.details}
                            onChange={(e) => updateItem(item.id, 'details', e.target.value)}
                            disabled={isGenerating}
                            placeholder="Product details"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm min-h-[60px] disabled:opacity-50"
                            data-testid={`textarea-details-${item.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            disabled={isGenerating}
                            placeholder="$99.99"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                            data-testid={`input-price-${item.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.location}
                            onChange={(e) => updateItem(item.id, 'location', e.target.value)}
                            disabled={isGenerating}
                            placeholder="City, State"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                            data-testid={`input-location-${item.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.mediaUrls}
                            onChange={(e) => updateItem(item.id, 'mediaUrls', e.target.value)}
                            disabled={isGenerating}
                            placeholder="URL1, URL2"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                            data-testid={`input-media-${item.id}`}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2">
                            {(['instagram', 'facebook', 'pinterest', 'twitter'] as Platform[]).map((platform) => (
                              <label key={platform} className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.platforms.includes(platform)}
                                  onChange={() => togglePlatform(item.id, platform)}
                                  disabled={isGenerating || !connectedPlatforms.has(platform)}
                                  className="h-3 w-3 rounded border-gray-300 disabled:opacity-50"
                                  data-testid={`checkbox-platform-${platform}-${item.id}`}
                                />
                                <span className="text-xs capitalize">{platform}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <select
                            value={item.action}
                            onChange={(e) => updateItem(item.id, 'action', e.target.value)}
                            disabled={isGenerating}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                            data-testid={`select-action-${item.id}`}
                          >
                            <option value="description_only">Description Only</option>
                            <option value="post_now">Post Now</option>
                            <option value="schedule">Schedule</option>
                          </select>
                        </td>
                        <td className="p-2">
                          {item.action === 'schedule' && (
                            <input
                              type="datetime-local"
                              value={item.scheduledAt}
                              onChange={(e) => updateItem(item.id, 'scheduledAt', e.target.value)}
                              disabled={isGenerating}
                              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm disabled:opacity-50"
                              data-testid={`input-scheduled-${item.id}`}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          {item.status === 'generating' && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </div>
                          )}
                          {item.status === 'completed' && item.generatedDescription && (
                            <div className="text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                              {item.generatedDescription}
                            </div>
                          )}
                          {item.status === 'error' && (
                            <div className="text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                              {item.errorMessage || 'Generation failed'}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => removeRow(item.id)}
                                variant="ghost"
                                size="icon"
                                disabled={isGenerating || items.length === 1}
                                className="h-8 w-8"
                                data-testid={`button-delete-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove row</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleGenerateBatch}
                disabled={isGenerating || items.length === 0}
                className="gap-2 min-w-[200px]"
                size="lg"
                data-testid="button-generate-batch"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating Batch...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-5 w-5" />
                    Generate Batch
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
