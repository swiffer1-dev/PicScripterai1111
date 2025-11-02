import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, CheckCircle, AlertCircle, Copy, Download, RotateCw, Edit3, Save, FileText, FileSpreadsheet, Menu } from "lucide-react";
import { Category, Tone } from '../types/ai-studio';
import { CATEGORY_PROMPTS } from '../lib/ai-constants';
import { generateDescription, proofreadText } from '../services/geminiService';
import ImageUploader from '../components/ImageUploader';
import CategorySelector from '../components/CategorySelector';
import LanguageSelector from '../components/LanguageSelector';
import type { Connection, Platform } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';

console.log("🔥 AI STUDIO PAGE LOADED - NEW CODE", new Date().toISOString());
console.log("🔑 GEMINI API KEY:", import.meta.env.VITE_GEMINI_API_KEY ? `SET (${import.meta.env.VITE_GEMINI_API_KEY.length} chars)` : 'NOT SET');

const StyleSettings: React.FC<{
  tone: Tone; onToneChange: (t: Tone) => void;
  addHashtags: boolean; onHashtagsChange: (c: boolean) => void;
  addEmojis: boolean; onEmojisChange: (c: boolean) => void;
}> = ({ tone, onToneChange, addHashtags, onHashtagsChange, addEmojis, onEmojisChange }) => (
  <div className="space-y-4">
    <div>
      <label htmlFor="tone-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
        Tone
      </label>
      <select
        id="tone-select"
        value={tone}
        onChange={e => onToneChange(e.target.value as Tone)}
        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm"
        data-testid="select-tone"
      >
        {['Professional', 'Casual', 'Luxury', 'Playful', 'Motivational'].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
    <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={addHashtags}
          onChange={e => onHashtagsChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          data-testid="checkbox-hashtags"
        />
        <span className="ml-2 text-sm">Add Hashtags</span>
      </label>
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={addEmojis}
          onChange={e => onEmojisChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          data-testid="checkbox-emojis"
        />
        <span className="ml-2 text-sm">Add Emojis</span>
      </label>
    </div>
  </div>
);

export default function AIStudio() {
  const { toast } = useToast();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>(Category.Travel);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [tone, setTone] = useState<Tone>('Casual');
  const [addHashtags, setAddHashtags] = useState(true);
  const [addEmojis, setAddEmojis] = useState(true);
  const [language, setLanguage] = useState<string>('English');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: connections, isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const connectedPlatforms = new Set(connections?.map(c => c.platform) || []);

  const { data: pinterestBoards } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pinterest/boards"],
    enabled: connectedPlatforms.has('pinterest'),
    retry: false,
  });

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
      
      // Return the object path in the format /objects/<relativePath>
      return response.objectPath;
    },
  });

  const postMutation = useMutation({
    mutationFn: async (data: {
      caption: string;
      platforms: Platform[];
      mediaUrl?: string;
    }) => {
      // Send one request per platform
      const promises = data.platforms.map(platform => {
        const postData: any = {
          platform,
          caption: data.caption,
        };
        
        // Include media if we have an uploaded image URL
        if (data.mediaUrl) {
          postData.media = {
            type: "image" as const,
            url: data.mediaUrl,
          };
        }
        
        // For Pinterest, include the board ID
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
      
      // Wait for all requests to complete
      const results = await Promise.allSettled(promises);
      
      // Check if any failed
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        throw new Error(`Failed to post to ${failures.length} platform(s): ${failures.map(f => f.reason.message).join(', ')}`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Posted successfully!",
        description: "Your content has been scheduled/posted to the selected platforms",
      });
      setGeneratedContent('');
      setImageFiles([]);
      setPreviewUrls([]);
      setUploadedImageUrls([]);
      setSelectedPlatforms([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Posting failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testApiKey = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("=== API KEY TEST ===");
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("API Key first 10 chars:", apiKey?.substring(0, 10) || 'N/A');
    toast({
      title: "API Key Check",
      description: apiKey ? `API Key is set (${apiKey.length} chars)` : "API Key is NOT set",
      variant: apiKey ? "default" : "destructive",
    });
  };

  const handleGenerate = async () => {
    console.log("=== GENERATE CAPTION CLICKED ===");
    console.log("Image files:", imageFiles.length);
    console.log("API Key exists:", !!import.meta.env.VITE_GEMINI_API_KEY);
    
    if (imageFiles.length === 0) {
      toast({
        title: "No images",
        description: "Please upload at least one image",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    toast({
      title: "Starting generation...",
      description: "Uploading images and preparing AI request",
    });
    
    try {
      // Upload images to object storage first
      toast({
        title: "Uploading images...",
        description: "Uploading your images to storage",
      });
      
      const uploadPromises = imageFiles.map(file => uploadImageMutation.mutateAsync(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      setUploadedImageUrls(uploadedUrls);
      
      // Generate caption
      const promptTemplate = CATEGORY_PROMPTS[category];
      const prompt = promptTemplate({
        customPrompt,
        language,
        socialPlatform: 'Instagram', // Default for generation
        tone,
        addHashtags,
        addEmojis,
      });

      // Generate caption using Gemini (already has resizing built in from geminiService)
      const result = await generateDescription(imageFiles, prompt);
      setGeneratedContent(result.description);
      
      toast({
        title: "Content generated!",
        description: "AI has created your social media caption and uploaded your images",
      });
    } catch (error) {
      console.error("Error generating caption:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        apiKey: import.meta.env.VITE_GEMINI_API_KEY ? 'SET (length: ' + import.meta.env.VITE_GEMINI_API_KEY.length + ')' : 'NOT SET',
      });
      
      // Clear any stale content on error
      setGeneratedContent("");
      setUploadedImageUrls([]);
      
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = () => {
    if (!generatedContent) {
      toast({
        title: "No content",
        description: "Please generate content first",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "No platforms selected",
        description: "Please select at least one connected platform",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({
      caption: generatedContent,
      platforms: selectedPlatforms,
      mediaUrl: uploadedImageUrls[0], // Use first uploaded image
    });
  };

  const togglePlatform = (platform: Platform) => {
    if (!connectedPlatforms.has(platform)) {
      toast({
        title: "Platform not connected",
        description: `Please connect your ${platform} account in the Connections page first`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleProofread = async () => {
    if (!generatedContent) return;
    
    setIsProofreading(true);
    try {
      const result = await proofreadText(generatedContent);
      if (result.hasCorrections) {
        setGeneratedContent(result.correctedText);
        toast({
          title: "Content proofread",
          description: result.changesSummary,
        });
      } else {
        toast({
          title: "No corrections needed",
          description: "Your content looks great!",
        });
      }
    } catch (error) {
      toast({
        title: "Proofread failed",
        description: error instanceof Error ? error.message : "Failed to proofread content",
        variant: "destructive",
      });
    } finally {
      setIsProofreading(false);
    }
  };

  const handleRegenerate = () => {
    if (imageFiles.length === 0) {
      toast({
        title: "No images",
        description: "Please upload images first",
        variant: "destructive",
      });
      return;
    }
    handleGenerate();
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    toast({ title: "Copied to clipboard!" });
  };

  const downloadAsFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Add centered title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const title = "PicScripter Content Report";
      const titleWidth = doc.getTextWidth(title);
      doc.text(title, (pageWidth - titleWidth) / 2, 20);
      
      // Add metadata
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const now = new Date();
      const dateStr = now.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'numeric', 
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });
      
      let yPos = 35;
      doc.text(`Generation Date: ${dateStr}`, 20, yPos);
      yPos += 7;
      doc.text(`Target Platform: ${category}`, 20, yPos);
      yPos += 7;
      doc.text(`Intended Tone: ${tone}`, 20, yPos);
      yPos += 10;
      
      // Add horizontal line
      doc.setLineWidth(0.5);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 15;
      
      // Add image if available
      if (previewUrls.length > 0) {
        try {
          const imgData = previewUrls[0];
          const imgWidth = 100;
          const imgHeight = 75;
          const imgX = (pageWidth - imgWidth) / 2;
          doc.addImage(imgData, 'JPEG', imgX, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 15;
        } catch (err) {
          console.error('Error adding image to PDF:', err);
        }
      }
      
      // Add "Generated Content" section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("Generated Content", 20, yPos);
      yPos += 8;
      
      // Add caption content with wrapping
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const splitText = doc.splitTextToSize(generatedContent, pageWidth - 40);
      doc.text(splitText, 20, yPos);
      
      // Save the PDF
      const timestamp = Date.now();
      doc.save(`picscripter-content-${timestamp}.pdf`);
      toast({ title: "Downloaded as PDF" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ 
        title: "PDF generation failed", 
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive" 
      });
    }
  };

  const handleDownloadWord = () => {
    // Create RTF format which opens in Word
    const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24
{\\b\\fs32 Generated Caption}\\par
\\par
${generatedContent.replace(/\n/g, '\\par\n')}
}`;
    downloadAsFile(rtfContent, 'caption.rtf', 'application/rtf');
    toast({ title: "Downloaded as Word document" });
  };

  const handleDownloadTXT = () => {
    downloadAsFile(generatedContent, 'caption.txt', 'text/plain');
    toast({ title: "Downloaded as TXT" });
  };

  const handleDownloadCSV = () => {
    const csv = `"Caption"\n"${generatedContent.replace(/"/g, '""')}"`;
    downloadAsFile(csv, 'caption.csv', 'text/csv');
    toast({ title: "Downloaded as CSV" });
  };

  const handleDownloadHTML = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Generated Caption</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .content { white-space: pre-wrap; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Generated Caption</h1>
  <div class="content">${generatedContent}</div>
</body>
</html>`;
    downloadAsFile(html, 'caption.html', 'text/html');
    toast({ title: "Downloaded as HTML" });
  };

  const saveDraftMutation = useMutation({
    mutationFn: async (data: { caption: string; mediaUrl?: string }) => {
      return apiRequest("POST", "/api/posts/draft", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({
        title: "Saved as draft",
        description: "Your content has been saved to drafts",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = () => {
    if (!generatedContent) {
      toast({
        title: "No content",
        description: "Please generate content first",
        variant: "destructive",
      });
      return;
    }

    saveDraftMutation.mutate({
      caption: generatedContent,
      mediaUrl: uploadedImageUrls[0],
    });
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
          <h1 className="text-lg font-semibold">Picscripter</h1>
        </div>

        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8 hidden lg:block">
            <h1 className="text-3xl font-semibold tracking-tight">Create</h1>
            <p className="text-muted-foreground mt-1.5">
              Generate AI-powered captions and post to your connected platforms
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Input */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Upload Images</h2>
                <ImageUploader
                  onImageChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    // Append new files to existing ones instead of replacing
                    setImageFiles(prev => [...prev, ...newFiles]);
                    const newUrls = newFiles.map(f => URL.createObjectURL(f));
                    setPreviewUrls(prev => [...prev, ...newUrls]);
                  }}
                  previewUrls={previewUrls}
                  isLoading={isGenerating}
                  onClearImages={() => {
                    setImageFiles([]);
                    setPreviewUrls([]);
                  }}
                  onDeleteImage={(index) => {
                    setImageFiles(prev => prev.filter((_, i) => i !== index));
                    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                  }}
                  onReorderImages={(dragIndex, hoverIndex) => {
                    setImageFiles(prev => {
                      const newFiles = [...prev];
                      const [removed] = newFiles.splice(dragIndex, 1);
                      newFiles.splice(hoverIndex, 0, removed);
                      return newFiles;
                    });
                    setPreviewUrls(prev => {
                      const newUrls = [...prev];
                      const [removed] = newUrls.splice(dragIndex, 1);
                      newUrls.splice(hoverIndex, 0, removed);
                      return newUrls;
                    });
                  }}
                />
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-lg font-semibold">Settings</h2>
                
                <CategorySelector
                  selectedCategory={category}
                  onCategoryChange={setCategory}
                  isDisabled={isGenerating}
                />

                <LanguageSelector
                  selectedLanguage={language}
                  onLanguageChange={setLanguage}
                  isDisabled={isGenerating}
                />

                <StyleSettings
                  tone={tone}
                  onToneChange={setTone}
                  addHashtags={addHashtags}
                  onHashtagsChange={setAddHashtags}
                  addEmojis={addEmojis}
                  onEmojisChange={setAddEmojis}
                />

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Custom Instructions (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm min-h-[80px]"
                    placeholder="Add any custom instructions for the AI..."
                    data-testid="textarea-custom-prompt"
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || imageFiles.length === 0}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Caption
                    </>
                  )}
                </Button>
              </div>

              {/* Connected Platforms Status */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Connected Platforms</h2>
                
                {loadingConnections ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(['instagram', 'facebook', 'pinterest', 'twitter', 'tiktok', 'linkedin', 'youtube'] as Platform[]).map(platform => {
                      const isConnected = connectedPlatforms.has(platform);
                      
                      return (
                        <div
                          key={platform}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                          data-testid={`connection-status-${platform}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{platform}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isConnected ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">Connected</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Not connected</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Output */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Generated Content</h2>
                  {generatedContent && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleCopy}
                        variant="ghost"
                        size="icon"
                        title="Copy to clipboard"
                        data-testid="button-copy-icon"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download"
                            data-testid="button-download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleDownloadPDF} data-testid="download-pdf">
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleDownloadWord} data-testid="download-word">
                            <FileText className="mr-2 h-4 w-4" />
                            Word Doc
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleDownloadTXT} data-testid="download-txt">
                            <FileText className="mr-2 h-4 w-4" />
                            Text File
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleDownloadCSV} data-testid="download-csv">
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleDownloadHTML} data-testid="download-html">
                            <FileText className="mr-2 h-4 w-4" />
                            HTML
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        onClick={handleRegenerate}
                        variant="ghost"
                        size="icon"
                        title="Regenerate"
                        disabled={isGenerating}
                        data-testid="button-regenerate"
                      >
                        <RotateCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      </Button>

                      <Button
                        onClick={handleProofread}
                        variant="ghost"
                        size="icon"
                        title="Proofread"
                        disabled={isProofreading}
                        data-testid="button-proofread"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      <Button
                        onClick={handleSaveDraft}
                        variant="ghost"
                        size="icon"
                        title="Save as draft"
                        disabled={saveDraftMutation.isPending}
                        data-testid="button-save-draft"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {generatedContent ? (
                  <div className="space-y-4">
                    {/* Show uploaded image(s) for easy reference on mobile */}
                    {previewUrls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 lg:hidden">
                        {previewUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-border"
                          />
                        ))}
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-4 min-h-[200px]">
                      <p className="text-sm whitespace-pre-wrap">{generatedContent}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground min-h-[200px] flex items-center justify-center">
                    <p>Your AI-generated caption will appear here</p>
                  </div>
                )}
              </div>

              {generatedContent && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4">Post to Platforms</h2>
                  
                  {loadingConnections ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : connections && connections.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {(['instagram', 'facebook', 'pinterest', 'twitter', 'tiktok', 'linkedin', 'youtube'] as Platform[]).map(platform => {
                          const isConnected = connectedPlatforms.has(platform);
                          const isSelected = selectedPlatforms.includes(platform);
                          
                          return (
                            <button
                              key={platform}
                              onClick={() => togglePlatform(platform)}
                              disabled={!isConnected}
                              className={`p-3 rounded-lg border transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : isConnected
                                  ? 'bg-card border-border hover:bg-muted'
                                  : 'bg-muted border-border opacity-50 cursor-not-allowed'
                              }`}
                              data-testid={`platform-${platform}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium capitalize">{platform}</span>
                                {isConnected && isSelected && (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                {!isConnected && (
                                  <AlertCircle className="h-4 w-4" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        onClick={handlePost}
                        disabled={postMutation.isPending || selectedPlatforms.length === 0}
                        className="w-full"
                        data-testid="button-post"
                      >
                        {postMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          `Post to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-4">No platforms connected yet</p>
                      <a
                        href="/connections"
                        className="text-primary hover:underline"
                        data-testid="link-connections"
                      >
                        Connect your social media accounts →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
