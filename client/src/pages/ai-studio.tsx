import { useState, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, CheckCircle, AlertCircle, Copy, Download, RotateCw, Edit3, Save, FileText, FileSpreadsheet, Menu, Zap } from "lucide-react";
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
      // Clean the text immediately to remove any encoding issues
      const cleanedDescription = cleanTextForExport(result.description);
      setGeneratedContent(cleanedDescription);
      
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

  const cleanTextForExport = (text: string): string => {
    if (!text) return '';
    
    // More aggressive cleaning - remove ALL non-standard characters
    let cleaned = text
      // First normalize Unicode characters
      .normalize('NFKD')
      // Remove all control characters and non-printable characters
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      // Remove zero-width spaces and other invisible characters
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      // Remove any RTF control sequences
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\\[a-z]+\d*\s?/gi, '')
      // Remove any remaining backslash commands
      .replace(/\\[^\s]/g, '')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Clean up multiple newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    // Only keep truly printable ASCII and common punctuation/symbols
    // This ensures compatibility across all formats
    cleaned = cleaned.split('').filter(char => {
      const code = char.charCodeAt(0);
      // Allow: space (32), standard printable ASCII (33-126), newline (10), tab (9)
      // and common extended characters (128-255) but be selective
      return (code === 10 || code === 9 || (code >= 32 && code <= 126) || 
              (code >= 128 && code <= 255 && /[\w\s.,!?;:'"-]/.test(char)));
    }).join('');
    
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

  const handleDownloadWord = async () => {
    try {
      // Create DOCX using jsPDF approach - generate as HTML then convert
      const cleanedContent = cleanTextForExport(generatedContent);
      
      // For Word, we'll create a richer HTML document with embedded base64 image
      let imageSection = '';
      if (previewUrls.length > 0) {
        // Ensure the image is properly embedded as base64
        const imageUrl = previewUrls[0];
        imageSection = `
    <div align="center" style="margin: 20px 0;">
      <img src="${imageUrl}" width="500" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
    </div>`;
      }
      
      const wordContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>PicScripter Content Report</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      margin: 1in;
    }
    body {
      font-family: 'Calibri', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 20pt;
      color: #2c3e50;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 20pt;
      margin-bottom: 10pt;
      color: #34495e;
    }
    .metadata {
      font-size: 10pt;
      color: #7f8c8d;
      margin-bottom: 20pt;
      padding-bottom: 10pt;
      border-bottom: 2pt solid #34495e;
    }
    .metadata p {
      margin: 5pt 0;
    }
    .content {
      font-size: 11pt;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <h1>PicScripter Content Report</h1>
  
  <div class="metadata">
    <p><b>Generation Date:</b> ${new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })}</p>
    <p><b>Target Platform:</b> ${category}</p>
    <p><b>Intended Tone:</b> ${tone}</p>
  </div>
  
  ${imageSection}
  
  <h2>Generated Content</h2>
  <div class="content">${cleanedContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
</body>
</html>`;

      const blob = new Blob(['\ufeff', wordContent], { 
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'picscripter-caption.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
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

  const handleDownloadHTML = () => {
    const cleanedContent = cleanTextForExport(generatedContent);
    // Escape HTML special characters
    const escapedContent = cleanedContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
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
                      {/* Smart Post Button */}
                      <Button
                        onClick={handleSmartPost}
                        disabled={postMutation.isPending}
                        className="w-full mb-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
                        size="lg"
                        data-testid="button-smart-post"
                      >
                        {postMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          <>
                            <Zap className="mr-2 h-5 w-5" />
                            Smart Post to All ({connectedPlatforms.size} platforms)
                          </>
                        )}
                      </Button>

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
