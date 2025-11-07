import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, Wand2, CheckCircle, AlertCircle, Copy, Download, RotateCw, Edit3, Save, FileText, FileSpreadsheet, Menu, Zap, Calendar, Sparkles, Store } from "lucide-react";
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
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import EXIF from 'exif-js';
import logoImage from "@assets/54001569-a0f4-4317-b11e-f801dff83e13_1762315521648.png";

console.log("🔥 AI STUDIO PAGE LOADED - NEW CODE", new Date().toISOString());
console.log("🔑 GEMINI API KEY:", import.meta.env.VITE_GEMINI_API_KEY ? `SET (${import.meta.env.VITE_GEMINI_API_KEY.length} chars)` : 'NOT SET');

const platformCharLimits: Record<Platform, number> = {
  instagram: 2200,
  tiktok: 2200,
  twitter: 280,
  linkedin: 3000,
  pinterest: 500,
  youtube: 5000,
  facebook: 63206,
};

const StyleSettings: React.FC<{
  tone: Tone; onToneChange: (t: Tone) => void;
  addHashtags: boolean; onHashtagsChange: (c: boolean) => void;
  addEmojis: boolean; onEmojisChange: (c: boolean) => void;
}> = ({ tone, onToneChange, addHashtags, onHashtagsChange, addEmojis, onEmojisChange }) => (
  <div className="space-y-4">
    <div>
      <label htmlFor="tone-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
        Tone - Human Authenticity Engine
      </label>
      <select
        id="tone-select"
        value={tone}
        onChange={e => onToneChange(e.target.value as Tone)}
        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm"
        data-testid="select-tone"
      >
        <optgroup label="🤖 AI-Proof Tones (Recommended)">
          <option value="Authentic">Authentic - Real & relatable</option>
          <option value="Conversational">Conversational - Like chatting with a friend</option>
          <option value="SEO Boosted">SEO Boosted - Searchable & natural</option>
        </optgroup>
        <optgroup label="Classic Tones">
          <option value="Professional">Professional</option>
          <option value="Casual">Casual</option>
          <option value="Luxury">Luxury</option>
          <option value="Playful">Playful</option>
          <option value="Motivational">Motivational</option>
        </optgroup>
      </select>
      <p className="text-xs text-muted-foreground mt-1.5">
        ✨ Fights AI-blog feel with natural rhythm, personality cues & buzzword detection
      </p>
    </div>
    <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={addHashtags}
              onChange={e => onHashtagsChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary transition-transform group-hover:scale-110"
              data-testid="checkbox-hashtags"
            />
            <span className="ml-2 text-sm">Add Hashtags</span>
          </label>
        </TooltipTrigger>
        <TooltipContent>Platform-optimized hashtags for better reach</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={addEmojis}
              onChange={e => onEmojisChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary transition-transform group-hover:scale-110"
              data-testid="checkbox-emojis"
            />
            <span className="ml-2 text-sm">Add Emojis</span>
          </label>
        </TooltipTrigger>
        <TooltipContent>Platform-specific emojis (works across all platforms)</TooltipContent>
      </Tooltip>
    </div>
  </div>
);

export default function AIStudio() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const sessionIdRef = useRef(0); // Track session resets
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>(Category.Travel);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [tone, setTone] = useState<Tone>('Authentic');
  const [addHashtags, setAddHashtags] = useState(true);
  const [addEmojis, setAddEmojis] = useState(true);
  const [language, setLanguage] = useState<string>('English');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState<string>('');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Infusing tone and style",
    "Analyzing visual context",
    "Crafting the perfect script",
    "Generating creative ideas"
  ];

  const { data: connections, isLoading: loadingConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: ecommerceConnections } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/connections"],
  });

  // Load caption from query parameter if provided (for "Send to Create" button)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const caption = urlParams.get('caption');
    if (caption) {
      // URLSearchParams already decodes the value, no need to decodeURIComponent
      setGeneratedContent(caption);
      toast({
        title: "Caption loaded",
        description: "You can now edit and enhance this content with AI",
      });
      // Clear the query parameter from URL to prevent reloading on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  // Cycle through loading messages when generating
  useEffect(() => {
    if (!isGenerating) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, [isGenerating, loadingMessages.length]);

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

  const saveDraftMutation = useMutation({
    mutationFn: async (data: {
      caption: string;
      mediaUrls: string[];
      settings: any;
    }) => {
      return apiRequest("POST", "/api/drafts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft saved!",
        description: "Your content has been saved as a draft",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save draft",
        description: error.message,
        variant: "destructive",
      });
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

    // Capture current session ID
    const currentSessionId = sessionIdRef.current;
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
      
      // Check if session was reset during upload
      if (sessionIdRef.current !== currentSessionId) {
        return; // Abort - session was reset
      }
      
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
        address: propertyAddress, // Include property address for Real Estate listings
      });

      console.log("🎯 EMOJI SETTING:", addEmojis);
      console.log("📝 FULL PROMPT:", prompt);
      console.log("📁 Category:", category);

      // Call backend API for caption generation with category verification
      const response = await apiRequest("POST", "/api/ai/generate", {
        imageUrls: uploadedUrls,
        prompt,
        category,
      });

      const result = await response.json();
      
      // Check if session was reset during generation
      if (sessionIdRef.current !== currentSessionId) {
        return; // Abort - session was reset
      }

      // Check for category mismatch
      if (result.categoryMismatch) {
        toast({
          title: "⚠️ Image doesn't match category",
          description: `This image looks like ${result.detectedObjects?.join(', ') || result.detectedCategory}, but you selected "${result.selectedCategory}". Please upload a matching image or change your category.`,
          variant: "destructive",
        });
        setGeneratedContent("");
        setIsGenerating(false);
        return;
      }
      
      // Clean the text immediately to remove any encoding issues
      const cleanedDescription = cleanTextForExport(result.description);
      setGeneratedContent(cleanedDescription);
      
      // Track caption_generated event
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            eventType: 'caption_generated',
            eventName: 'Caption generated',
            properties: { category, tone, language },
          }),
        });
      } catch (error) {
        console.error('Failed to track analytics:', error);
      }
      
      toast({
        title: "✨ Content generated!",
        description: "AI has created your social media caption and uploaded your images",
      });
    } catch (error) {
      console.error("Error generating caption:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        apiKey: import.meta.env.VITE_GEMINI_API_KEY ? 'SET (length: ' + import.meta.env.VITE_GEMINI_API_KEY.length + ')' : 'NOT SET',
      });
      
      // Check if session was reset
      if (sessionIdRef.current !== currentSessionId) {
        return; // Abort - session was reset
      }
      
      // Clear any stale content on error
      setGeneratedContent("");
      setUploadedImageUrls([]);
      
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      // Only update loading state if session hasn't been reset
      if (sessionIdRef.current === currentSessionId) {
        setIsGenerating(false);
      }
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

    // Check character limits for selected platforms
    const captionLength = generatedContent.length;
    const platformsExceedingLimit = selectedPlatforms.filter(
      platform => captionLength > platformCharLimits[platform]
    );

    if (platformsExceedingLimit.length > 0) {
      const platformNames = platformsExceedingLimit
        .map(p => `${p.charAt(0).toUpperCase() + p.slice(1)} (${platformCharLimits[p]} max)`)
        .join(', ');
      
      toast({
        title: "Caption too long",
        description: `Your caption (${captionLength} characters) exceeds the limit for: ${platformNames}. Please shorten it or deselect those platforms.`,
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

  const handleSmartPost = () => {
    if (!generatedContent) {
      toast({
        title: "No content",
        description: "Please generate content first",
        variant: "destructive",
      });
      return;
    }

    if (connections && connections.length === 0) {
      toast({
        title: "No platforms connected",
        description: "Please connect at least one social media account",
        variant: "destructive",
      });
      return;
    }

    // Get all connected platforms
    const allConnectedPlatforms = Array.from(connectedPlatforms) as Platform[];
    
    // Check character limits for all connected platforms
    const captionLength = generatedContent.length;
    const platformsExceedingLimit = allConnectedPlatforms.filter(
      platform => captionLength > platformCharLimits[platform]
    );

    if (platformsExceedingLimit.length > 0) {
      const platformNames = platformsExceedingLimit
        .map(p => `${p.charAt(0).toUpperCase() + p.slice(1)} (${platformCharLimits[p]} max)`)
        .join(', ');
      
      toast({
        title: "Caption too long for some platforms",
        description: `Your caption (${captionLength} characters) exceeds the limit for: ${platformNames}. Content will be automatically truncated for these platforms.`,
        variant: "default",
      });
      
      // Filter out platforms that exceed the limit for Smart Post
      const validPlatforms = allConnectedPlatforms.filter(
        platform => captionLength <= platformCharLimits[platform]
      );
      
      if (validPlatforms.length === 0) {
        toast({
          title: "Caption too long",
          description: "Your caption exceeds the character limit for all connected platforms. Please shorten it.",
          variant: "destructive",
        });
        return;
      }
      
      // Post only to platforms within limit
      postMutation.mutate({
        caption: generatedContent,
        platforms: validPlatforms,
        mediaUrl: uploadedImageUrls[0],
      });
      return;
    }
    
    // Post to all connected platforms
    postMutation.mutate({
      caption: generatedContent,
      platforms: allConnectedPlatforms,
      mediaUrl: uploadedImageUrls[0],
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
        // Clean the proofread text too
        const cleanedText = cleanTextForExport(result.correctedText);
        setGeneratedContent(cleanedText);
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

  const handleNewSession = () => {
    // Increment session ID to cancel any in-flight operations
    sessionIdRef.current += 1;
    
    // Force stop loading states
    setIsGenerating(false);
    setIsProofreading(false);
    
    // Clear all state
    setImageFiles([]);
    setPreviewUrls([]);
    setUploadedImageUrls([]);
    setGeneratedContent('');
    setCustomPrompt('');
    setPropertyAddress('');
    setCategory(Category.Travel);
    setTone('Authentic');
    setAddHashtags(true);
    setAddEmojis(true);
    setLanguage('English');
    setSelectedPlatforms([]);
    
    toast({
      title: "New session started",
      description: "All content and settings have been cleared",
    });
  };

  const handleSchedule = () => {
    if (!generatedContent) {
      toast({
        title: "No content",
        description: "Please generate content first",
        variant: "destructive",
      });
      return;
    }
    
    // Save data to session storage for the calendar page to pick up
    sessionStorage.setItem('schedule-draft', JSON.stringify({
      caption: generatedContent,
      imageUrl: uploadedImageUrls[0] || null,
      timestamp: Date.now(),
    }));
    
    // Navigate to calendar page
    setLocation('/calendar');
    toast({
      title: "Opening calendar",
      description: "Your content is ready to schedule",
    });
  };

  const cleanTextForExport = (text: string): string => {
    if (!text) return '';
    
    // Light cleaning - PRESERVE EMOJIS and Unicode characters!
    let cleaned = text
      // Remove only harmful control characters (NOT emojis!)
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      // Remove zero-width spaces and other invisible characters
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      // Remove any RTF control sequences
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\\[a-z]+\d*\s?/gi, '')
      // Remove any remaining backslash commands
      .replace(/\\[^\s]/g, '')
      // Clean up multiple spaces (but preserve single spaces)
      .replace(/ {2,}/g, ' ')
      // Clean up excessive newlines (3+ becomes 2)
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();
    
    // DO NOT filter characters! The old code stripped all emojis because
    // emojis have Unicode code points above 255 (e.g., 😊 is U+1F60A = 128522)
    // We want to keep emojis, accented characters, and all valid Unicode
    
    return cleaned;
  };

  const downloadAsFile = (content: string, filename: string, mimeType: string) => {
    const cleanContent = cleanTextForExport(content);
    const blob = new Blob([cleanContent], { type: mimeType + ';charset=utf-8' });
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
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 20;
      const rightMargin = 20;
      const maxLineWidth = pageWidth - leftMargin - rightMargin;
      
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
      doc.text(`Generation Date: ${dateStr}`, leftMargin, yPos);
      yPos += 7;
      doc.text(`Target Platform: ${category}`, leftMargin, yPos);
      yPos += 7;
      doc.text(`Intended Tone: ${tone}`, leftMargin, yPos);
      yPos += 10;
      
      // Add horizontal line
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      yPos += 15;
      
      // Add image if available
      if (previewUrls.length > 0) {
        try {
          const imgData = previewUrls[0];
          const imgWidth = 100;
          const imgHeight = 75;
          const imgX = (pageWidth - imgWidth) / 2;
          
          // Check if we need a new page for the image
          if (yPos + imgHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.addImage(imgData, 'JPEG', imgX, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 15;
        } catch (err) {
          console.error('Error adding image to PDF:', err);
        }
      }
      
      // Add "Generated Content" section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      
      // Check if we need a new page
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text("Generated Content", leftMargin, yPos);
      yPos += 10;
      
      // Clean and wrap caption content properly
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const cleanedContent = cleanTextForExport(generatedContent);
      
      // Split text with proper wrapping
      const lines = doc.splitTextToSize(cleanedContent, maxLineWidth);
      const lineHeight = 6; // Space between lines
      
      // Add text with pagination
      for (let i = 0; i < lines.length; i++) {
        // Check if we need a new page
        if (yPos + lineHeight > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(lines[i], leftMargin, yPos);
        yPos += lineHeight;
      }
      
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

  // Helper function to fix image orientation (fixes sideways mobile photos)
  const getOrientedImageData = async (file: File): Promise<{ data: Uint8Array; width: number; height: number }> => {
    try {
      // Try modern createImageBitmap API first (Chrome, Firefox)
      if ('createImageBitmap' in window) {
        try {
          const imageBitmap = await createImageBitmap(file, {
            imageOrientation: 'from-image'
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = imageBitmap.width;
          canvas.height = imageBitmap.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas context');
          
          ctx.drawImage(imageBitmap, 0, 0);
          imageBitmap.close();
          
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Blob creation failed')), 'image/png');
          });
          
          const arrayBuffer = await blob.arrayBuffer();
          return {
            data: new Uint8Array(arrayBuffer),
            width: canvas.width,
            height: canvas.height
          };
        } catch (e) {
          console.log('createImageBitmap failed, trying EXIF fallback:', e);
        }
      }
      
      // Fallback for Safari/iOS: Manual EXIF handling
      return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
          // Get EXIF orientation
          EXIF.getData(img as any, function(this: any) {
            const orientation = EXIF.getTag(this, 'Orientation') || 1;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(url);
              reject(new Error('No canvas context'));
              return;
            }
            
            let width = img.width;
            let height = img.height;
            
            // Set canvas size based on orientation
            if (orientation > 4) {
              canvas.width = height;
              canvas.height = width;
            } else {
              canvas.width = width;
              canvas.height = height;
            }
            
            // Apply transformation based on EXIF orientation
            switch (orientation) {
              case 2:
                ctx.transform(-1, 0, 0, 1, width, 0);
                break;
              case 3:
                ctx.transform(-1, 0, 0, -1, width, height);
                break;
              case 4:
                ctx.transform(1, 0, 0, -1, 0, height);
                break;
              case 5:
                ctx.transform(0, 1, 1, 0, 0, 0);
                break;
              case 6:
                ctx.transform(0, 1, -1, 0, height, 0);
                break;
              case 7:
                ctx.transform(0, -1, -1, 0, height, width);
                break;
              case 8:
                ctx.transform(0, -1, 1, 0, 0, width);
                break;
              default:
                break;
            }
            
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            
            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              const arrayBuffer = await blob.arrayBuffer();
              resolve({
                data: new Uint8Array(arrayBuffer),
                width: canvas.width,
                height: canvas.height
              });
            }, 'image/png');
          });
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        
        img.src = url;
      });
    } catch (error) {
      console.error('All orientation methods failed:', error);
      toast({
        title: "Image orientation warning",
        description: "Could not fix image rotation. Image may appear sideways in download.",
        variant: "destructive"
      });
      
      // Last resort fallback: return original with estimated dimensions
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });
      
      const arrayBuffer = await file.arrayBuffer();
      return {
        data: new Uint8Array(arrayBuffer),
        width: img.width,
        height: img.height
      };
    }
  };

  const handleDownloadWord = async () => {
    try {
      const cleanedContent = cleanTextForExport(generatedContent);
      
      // Build document sections
      const sections: Paragraph[] = [];
      
      // Title
      sections.push(
        new Paragraph({
          text: "PicScripter Content Report",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        })
      );
      
      // Metadata
      sections.push(new Paragraph({ text: "" })); // Spacing
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Generation Date: ", bold: true }),
            new TextRun(new Date().toLocaleString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            })),
          ],
        })
      );
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Target Platform: ", bold: true }),
            new TextRun(category),
          ],
        })
      );
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Intended Tone: ", bold: true }),
            new TextRun(tone),
          ],
        })
      );
      
      sections.push(new Paragraph({ text: "" })); // Spacing
      
      // Add image if available with proper orientation
      if (imageFiles.length > 0) {
        const imageFile = imageFiles[0];
        // Use helper to get properly oriented image data
        const { data: imageData, width, height } = await getOrientedImageData(imageFile);
        
        // Scale image to fit page width (max 500px) while preserving aspect ratio
        const maxWidth = 500;
        let finalWidth = width;
        let finalHeight = height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          finalWidth = maxWidth;
          finalHeight = Math.round(height * ratio);
        }
        
        sections.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageData,
                transformation: {
                  width: finalWidth,
                  height: finalHeight,
                },
                type: 'png',
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
        
        sections.push(new Paragraph({ text: "" })); // Spacing
      }
      
      // Content heading
      sections.push(
        new Paragraph({
          text: "Generated Content",
          heading: HeadingLevel.HEADING_2,
        })
      );
      
      sections.push(new Paragraph({ text: "" })); // Spacing
      
      // Content - split by newlines to preserve formatting
      const contentLines = cleanedContent.split('\n');
      contentLines.forEach(line => {
        sections.push(new Paragraph({ text: line }));
      });
      
      // Create document
      const doc = new Document({
        sections: [{
          properties: {},
          children: sections,
        }],
      });
      
      // Generate and download
      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'picscripter-caption.docx');
      
      toast({ title: "Downloaded as Word document with image" });
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast({ 
        title: "Word download failed", 
        description: error instanceof Error ? error.message : "Failed to generate Word document",
        variant: "destructive" 
      });
    }
  };

  const handleDownloadTXT = () => {
    downloadAsFile(generatedContent, 'caption.txt', 'text/plain');
    toast({ title: "Downloaded as TXT" });
  };

  const handleDownloadCSV = () => {
    const cleanedContent = cleanTextForExport(generatedContent);
    const csv = `"Caption"\n"${cleanedContent.replace(/"/g, '""')}"`;
    // Don't use downloadAsFile to avoid double-cleaning
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'caption.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded as CSV" });
  };

  const handleDownloadHTML = async () => {
    try {
      const cleanedContent = cleanTextForExport(generatedContent);
      // Escape HTML special characters
      const escapedContent = cleanedContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Add image if available - convert to base64 with proper orientation
      let imageSection = '';
      if (imageFiles.length > 0) {
        const imageFile = imageFiles[0];
        // Get properly oriented image data
        const { data: imageData } = await getOrientedImageData(imageFile);
        // Convert to base64
        const blob = new Blob([imageData], { type: 'image/png' });
        const reader = new FileReader();
        const base64Image = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        imageSection = `<div style="text-align: center; margin: 20px 0;"><img src="${base64Image}" style="max-width: 600px; height: auto;" /></div>`;
      }
      
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
  ${imageSection}
  <div class="content">${escapedContent}</div>
</body>
</html>`;
      // Don't use downloadAsFile to avoid double-cleaning
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'caption.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded as HTML with image" });
    } catch (error) {
      console.error('Error generating HTML:', error);
      toast({ 
        title: "HTML download failed", 
        description: error instanceof Error ? error.message : "Failed to generate HTML",
        variant: "destructive" 
      });
    }
  };

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
      mediaUrls: uploadedImageUrls,
      settings: {
        category,
        tone,
        language,
        addHashtags,
        addEmojis,
        customPrompt,
        propertyAddress,
      },
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
          <img 
            src={logoImage} 
            alt="Picscripterai" 
            className="h-12 w-auto object-contain"
            data-testid="img-logo-mobile-create"
          />
        </div>

        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          <div className="mb-6 lg:mb-8 flex items-start justify-between">
            <div className="hidden lg:block">
              <h1 className="text-3xl font-semibold tracking-tight">Create</h1>
              <p className="text-muted-foreground mt-1.5">
                Generate AI-powered captions and post to your connected platforms
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNewSession}
                  variant="outline"
                  className="gap-2 transition-all hover:scale-105"
                  data-testid="button-new-session"
                >
                  <RotateCw className="h-4 w-4" />
                  <span className="hidden sm:inline">New Session</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all content and start fresh</TooltipContent>
            </Tooltip>
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

                {/* Real Estate Address Input */}
                {category === Category.RealEstate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Property Address
                    </label>
                    <input
                      type="text"
                      value={propertyAddress}
                      onChange={e => setPropertyAddress(e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm"
                      placeholder="Enter property address (e.g., 123 Main St, New York, NY 10001)"
                      data-testid="input-property-address"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      AI will include nearby schools, shopping, parks, and amenities in the description
                    </p>
                  </div>
                )}

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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || imageFiles.length === 0}
                      className="w-full transition-all hover:scale-[1.02]"
                      data-testid="button-generate"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="animate-pulse">Analyzing images & generating content...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Generate Caption
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>AI-powered caption generation with Human Authenticity Engine</p>
                  </TooltipContent>
                </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleCopy}
                            variant="ghost"
                            size="icon"
                            className="transition-all hover:scale-110"
                            data-testid="button-copy-icon"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy to clipboard</TooltipContent>
                      </Tooltip>
                      
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="transition-all hover:scale-110"
                                data-testid="button-download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Download in multiple formats</TooltipContent>
                        </Tooltip>
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

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleRegenerate}
                            variant="ghost"
                            size="icon"
                            className="transition-all hover:scale-110"
                            disabled={isGenerating}
                            data-testid="button-regenerate"
                          >
                            <RotateCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generate new variation</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleProofread}
                            variant="ghost"
                            size="icon"
                            className="transition-all hover:scale-110"
                            disabled={isProofreading}
                            data-testid="button-proofread"
                          >
                            {isProofreading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Edit3 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isProofreading ? "Proofreading grammar & spelling..." : "Check grammar & spelling"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleSaveDraft}
                            variant="ghost"
                            size="icon"
                            className="transition-all hover:scale-110"
                            disabled={saveDraftMutation.isPending}
                            data-testid="button-save-draft"
                          >
                            {saveDraftMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {saveDraftMutation.isPending ? "Saving draft..." : "Save as draft"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleSchedule}
                            variant="ghost"
                            size="icon"
                            className="transition-all hover:scale-110"
                            data-testid="button-schedule"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Schedule to calendar</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
                {isGenerating ? (
                  <div className="bg-muted/50 rounded-lg p-8 text-center min-h-[200px] flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-500 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                    </div>
                    <p className="text-base font-medium text-foreground animate-pulse">
                      {loadingMessages[loadingMessageIndex]}...
                    </p>
                  </div>
                ) : generatedContent ? (
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
                    
                    {/* Character Counter */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">Character Count</span>
                        <span className="font-mono font-semibold">{generatedContent.length}</span>
                      </div>
                      
                      {/* Platform Limits */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(['twitter', 'pinterest', 'instagram', 'tiktok', 'linkedin', 'youtube'] as Platform[]).map(platform => {
                          const limit = platformCharLimits[platform];
                          const isOver = generatedContent.length > limit;
                          const isConnected = connectedPlatforms.has(platform);
                          
                          return (
                            <div
                              key={platform}
                              className={`flex items-center justify-between px-2 py-1 rounded ${
                                !isConnected 
                                  ? 'bg-muted/30 text-muted-foreground/50'
                                  : isOver 
                                    ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' 
                                    : 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400'
                              }`}
                            >
                              <span className="capitalize font-medium">{platform}</span>
                              <span className="font-mono">
                                {isOver ? `${limit - generatedContent.length}` : `${limit - generatedContent.length}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        ✓ Green = within limit, Red = exceeds limit, Grayed = not connected
                      </p>
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
                  
                  {/* E-commerce Platforms Section */}
                  {ecommerceConnections && ecommerceConnections.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Connected Stores (Product Data Available)
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {ecommerceConnections.map((conn: any) => (
                          <div
                            key={conn.id}
                            className="p-3 rounded-lg border border-border bg-muted/30"
                            data-testid={`ecommerce-${conn.platform}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium capitalize">{conn.platform}</span>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            {conn.storeName && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{conn.storeName}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {loadingConnections ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : connections && connections.length > 0 ? (
                    <>
                      {/* Smart Post Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleSmartPost}
                            disabled={postMutation.isPending}
                            className="w-full mb-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all hover:scale-[1.02]"
                            size="lg"
                            data-testid="button-smart-post"
                          >
                            {postMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                <span className="animate-pulse">Posting to all platforms...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-5 w-5" />
                                Smart Post to All ({connectedPlatforms.size} platforms)
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Instantly post to all connected platforms</p>
                        </TooltipContent>
                      </Tooltip>

                      <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">Or select manually</span>
                        </div>
                      </div>

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
