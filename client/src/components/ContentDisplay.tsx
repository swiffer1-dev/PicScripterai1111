import React, { useState, useCallback, useRef, useEffect } from 'react';
import Tooltip from './Tooltip';
import { DiffEntry, BatchResultItem } from '../types';

// TypeScript declaration for jsPDF and the File System Access API
declare global {
  interface Window {
    jspdf: any;
    docx: any;
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: {
      description?: string;
      accept?: Record<string, string[]>;
    }[];
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream {
    write(data: BlobPart): Promise<void>;
    close(): Promise<void>;
  }
}

interface ContentDisplayProps {
  content: string;
  batchResults: BatchResultItem[];
  isBatchMode: boolean;
  isLoading: boolean;
  loadingMessage: string;
  generationProgress: number;
  previewUrls: string[];
  onClearContent: () => void;
  onSaveDraft: () => void;
  onSaveBatchItemAsDraft: (item: BatchResultItem) => void;
  onSaveAllAsDrafts: () => void;
  isDraftSelected: boolean;
  isEditing: boolean;
  onEditDraft: () => void;
  onUpdateDraft: () => void;
  isSaving: boolean;
  hasImages: boolean;
  onRegenerate: () => void;
  onProofread: () => void;
  onProofreadBatchItem: (itemId: string) => void;
  isProofreading: boolean;
  proofreadMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  proofreadDiff: DiffEntry[] | null;
  proofreadHasCorrections: boolean;
  tone: string;
  socialPlatform: string;
  onSmartPostClick: () => void;
  onSmartPostBatchItemClick: (item: BatchResultItem) => void;
  onAcceptProofread: () => void;
  onAcceptProofreadBatchItem: (itemId: string) => void;
}

const ProofreadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const SpinnerIcon = () => (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const ClipboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.043c0 .317-.1.619-.275.865a2.25 2.25 0 01-1.927 1.185H9.75M16.5 18.75h-9a2.25 2.25 0 01-2.25-2.25v-9c0-1.244 1.006-2.25 2.25-2.25h9A2.25 2.25 0 0118.75 7.5v9a2.25 2.25 0 01-2.25-2.25z" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.5 21.75l-.398-1.178a3.375 3.375 0 00-2.456-2.456L12.5 18l1.178-.398a3.375 3.375 0 002.456-2.456L16.5 14.25l.398 1.178a3.375 3.375 0 002.456 2.456L20.5 18l-1.178.398a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

const RegenerateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.182l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185" />
    </svg>
);

const BookmarkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const SmartPostIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 00-5.84-2.56m0 0a14.98 14.98 0 00-5.84 2.56m5.84-2.56V4.72a.75.75 0 011.5 0v4.82m-1.5 0a14.98 14.98 0 00-5.84 2.56m5.84-2.56a14.98 14.98 0 005.84 2.56m0 0a14.98 14.98 0 005.84-2.56m-5.84 2.56v4.82a6 6 0 01-5.84-7.38m5.84 2.56a14.983 14.983 0 01-5.84-2.56m-12 .56a14.983 14.983 0 015.84-2.56m0 0V4.72a.75.75 0 011.5 0v4.82" />
  </svg>
);


const CreativityScore: React.FC = () => {
    const [score, setScore] = useState(0);
    useEffect(() => {
        // Animate score on mount
        const randomScore = Math.floor(85 + Math.random() * 15); // 85-100
        const timer = setTimeout(() => setScore(randomScore), 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>Creativity Score</span>
                <span>{score}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
                <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${score}%` }}
                ></div>
            </div>
        </div>
    );
};

interface BatchItemCardProps {
  item: BatchResultItem;
  onSaveDraft: (item: BatchResultItem) => void;
  onProofread: (itemId: string) => void;
  onDownloadItem: (item: BatchResultItem, format: 'pdf' | 'docx' | 'html' | 'csv' | 'txt') => void;
  onSmartPostClick: (item: BatchResultItem) => void;
  isDownloadMenuOpen: boolean;
  onToggleDownloadMenu: (itemId: string) => void;
  onAcceptProofread: (itemId: string) => void;
}

const BatchItemCard: React.FC<BatchItemCardProps> = ({ item, onSaveDraft, onProofread, onDownloadItem, onSmartPostClick, isDownloadMenuOpen, onToggleDownloadMenu, onAcceptProofread }) => {
  const [copied, setCopied] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-100 dark:bg-black/20 p-4 rounded-xl border border-gray-200 dark:border-white/10 flex gap-4">
      <img src={item.previewUrl} alt="Preview" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
      <div className="flex-grow min-w-0">
        {item.proofreadDiff ? (
            <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words">
                {item.proofreadDiff.map((part, index) => {
                    if (part.type === 'added') return <span key={index} className="bg-green-500/20 text-green-700 dark:text-green-300 rounded px-0.5">{part.value}</span>;
                    if (part.type === 'removed') return <span key={index} className="bg-red-500/20 text-red-700 dark:text-red-300 rounded px-0.5 line-through">{part.value}</span>;
                    return <span key={index}>{part.value}</span>;
                })}
            </p>
        ) : (
            <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words">{item.content}</p>
        )}
        {item.proofreadMessage && (
            <div className={`mt-2 p-1.5 rounded-md text-xs flex items-center justify-between ${
                item.proofreadMessage.type === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-300' :
                item.proofreadMessage.type === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-300' :
                'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            }`}>
                <span>{item.proofreadMessage.text}</span>
                 {item.proofreadDiff && item.proofreadMessage.type !== 'error' && item.hasCorrections && (
                    <button
                        onClick={() => onAcceptProofread(item.id)}
                        className="ml-2 px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                        Accept
                    </button>
                )}
            </div>
        )}
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <Tooltip text={copied ? 'Copied!' : 'Copy'}>
            <button onClick={handleCopy} className="p-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-md transition-colors">
              {copied ? <CheckCircleIcon /> : <ClipboardIcon />}
            </button>
          </Tooltip>
          <Tooltip text="Save as Draft">
            <button onClick={() => onSaveDraft(item)} className="p-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-md transition-colors">
              <BookmarkIcon />
            </button>
          </Tooltip>
           <Tooltip text="Proofread">
              <button 
                  onClick={() => onProofread(item.id)} 
                  disabled={item.isProofreading} 
                  className="p-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
              >
                  {item.isProofreading ? <SpinnerIcon /> : <ProofreadIcon />}
              </button>
          </Tooltip>
           <div className="relative" ref={downloadMenuRef}>
              <Tooltip text="Download">
                  <button 
                      onClick={() => onToggleDownloadMenu(item.id)} 
                      className="p-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-md transition-colors"
                  >
                      <DownloadIcon />
                  </button>
              </Tooltip>
              {isDownloadMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-52 bg-gray-800/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-600 dark:border-white/20 rounded-lg shadow-lg z-20 transition-opacity duration-200 opacity-100">
                      <ul className="py-1 text-sm text-gray-300 dark:text-gray-200">
                          <li onClick={() => onDownloadItem(item, 'pdf')} 
                              className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center"
                          >
                              Export as PDF
                          </li>
                          <li onClick={() => onDownloadItem(item, 'docx')}
                              className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center"
                          >
                              Export as Word (.docx)
                          </li>
                          <li onClick={() => onDownloadItem(item, 'html')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as HTML</li>
                          <li onClick={() => onDownloadItem(item, 'csv')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as CSV</li>
                          <li onClick={() => onDownloadItem(item, 'txt')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as Text (.txt)</li>
                      </ul>
                  </div>
              )}
          </div>
          <Tooltip text="Smart Post">
            <button onClick={() => onSmartPostClick(item)} className="p-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-md transition-colors">
              <SmartPostIcon />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};


const ContentDisplay: React.FC<ContentDisplayProps> = ({ 
    content, batchResults, isBatchMode, isLoading, loadingMessage, generationProgress, previewUrls, onClearContent, 
    onSaveDraft, onSaveBatchItemAsDraft, onSaveAllAsDrafts, isDraftSelected, isEditing, 
    onEditDraft, onUpdateDraft, isSaving, hasImages, onRegenerate, onProofread, 
    onProofreadBatchItem, isProofreading, proofreadMessage, proofreadDiff, proofreadHasCorrections,
    tone, socialPlatform, onSmartPostClick, onSmartPostBatchItemClick,
    onAcceptProofread, onAcceptProofreadBatchItem
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [openBatchDownloadMenuId, setOpenBatchDownloadMenuId] = useState<string | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const loadingPhrases = ["Crafting the perfect caption...", "Infusing tone & style...", "Analyzing visual context...", "Generating creative ideas..."];
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(loadingPhrases[0]);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setCurrentLoadingPhrase(prev => {
          const currentIndex = loadingPhrases.indexOf(prev);
          return loadingPhrases[(currentIndex + 1) % loadingPhrases.length];
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggleDownloadMenu = useCallback(() => {
    setIsDownloadMenuOpen(prev => !prev);
  }, []);
  
  const handleToggleBatchDownloadMenu = (itemId: string) => {
    setOpenBatchDownloadMenuId(prevId => prevId === itemId ? null : itemId);
  };

  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [content]);
  
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  type DownloadFormat = 'pdf' | 'docx' | 'html' | 'csv' | 'txt';
  const handleDownload = useCallback((format: DownloadFormat, itemData?: { content: string; previewUrls: string[]; id: string }) => {
    const currentContent = itemData ? itemData.content : content;
    const currentPreviewUrls = itemData ? itemData.previewUrls : previewUrls;
    const itemId = itemData ? itemData.id.substring(0, 10) : 'content';

    if (!currentContent) return;
    const filenameBase = `picscripter-${itemId}-${Date.now()}`;
    
    if (format === 'txt') {
        const blob = new Blob([currentContent], { type: 'text/plain' });
        triggerDownload(blob, `${filenameBase}.txt`);
    } else if (format === 'csv') {
        const csvContent = `"Generated Content"\n"${currentContent.replace(/"/g, '""')}"`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        triggerDownload(blob, `${filenameBase}.csv`);
    } else if (format === 'html') {
        const htmlContent = `<!DOCTYPE html><html><head><title>Generated Content</title></head><body><pre>${currentContent}</pre></body></html>`;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        triggerDownload(blob, `${filenameBase}.html`);
    } else if (format === 'pdf') {
        if (!window.jspdf) {
            alert("PDF generation library is not available. Please check your internet connection and try refreshing the page.");
            console.error("jsPDF library (window.jspdf) not found.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const generationDate = new Date().toLocaleString();
        const imageUrl = currentPreviewUrls.length > 0 ? currentPreviewUrls[0] : null;
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageW - (margin * 2);
        let yPos = 20;

        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PicScripter Content Report', pageW / 2, yPos, { align: 'center' });
        yPos += 15;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generation Date: ${generationDate}`, margin, yPos);
        doc.text(`Target Platform: ${socialPlatform}`, margin, yPos + 7);
        doc.text(`Intended Tone: ${tone}`, margin, yPos + 14);
        yPos += 24;

        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 10;

        if (imageUrl) {
            try {
                const imgSize = 80;
                const imgX = (pageW - imgSize) / 2;
                doc.addImage(imageUrl, 'JPEG', imgX, yPos, imgSize, imgSize, undefined, 'FAST');
                yPos += imgSize + 10;
            } catch (e) {
                console.error("Could not add image to PDF:", e);
                doc.setTextColor(150);
                doc.text("Preview image could not be loaded into the PDF.", margin, yPos);
                doc.setTextColor(0);
                yPos += 10;
            }
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Generated Content', margin, yPos);
        yPos += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(currentContent, contentWidth);
        doc.text(lines, margin, yPos);

        doc.save(`${filenameBase}.pdf`);
    } else if (format === 'docx') {
        if (!window.docx) {
          alert("Word document generation library is not available. Please check your internet connection and try refreshing the page.");
          console.error("DOCX library (window.docx) not found.");
          return;
        }
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = window.docx;

        const createDocxWithImage = async () => {
          const generationDate = new Date().toLocaleString();
          const imageUrl = currentPreviewUrls.length > 0 ? currentPreviewUrls[0] : null;

          const docChildren: any[] = [
            new Paragraph({ text: "PicScripter Content Report", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Details", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [ new TextRun({ text: "Generation Date:\t", bold: true }), new TextRun(generationDate) ] }),
            new Paragraph({ children: [ new TextRun({ text: "Target Platform:\t", bold: true }), new TextRun(socialPlatform) ] }),
            new Paragraph({ children: [ new TextRun({ text: "Intended Tone:\t\t", bold: true }), new TextRun(tone) ] }),
          ];

          if (imageUrl) {
            try {
              const response = await fetch(imageUrl);
              const imageBuffer = await response.arrayBuffer();
              docChildren.push(
                new Paragraph({ text: "" }),
                new Paragraph({
                  children: [ new ImageRun({ data: imageBuffer, transformation: { width: 400, height: 400 } }) ],
                  alignment: AlignmentType.CENTER,
                })
              );
            } catch (e) {
              console.error("Could not add image to DOCX:", e);
              docChildren.push(new Paragraph({ text: "\n[Image could not be embedded into the document.]" }));
            }
          }

          docChildren.push(
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Generated Content", heading: HeadingLevel.HEADING_1 }),
            ...currentContent.split('\n').map((line) => new Paragraph({ text: line }))
          );

          const doc = new Document({
            creator: "PicScripter",
            title: "PicScripter Content Report",
            description: "Content generated by PicScripter AI",
            sections: [{ children: docChildren }],
          });

          const blob = await Packer.toBlob(doc);
          triggerDownload(blob, `${filenameBase}.docx`);
        };

        createDocxWithImage();
    }

    setIsDownloadMenuOpen(false);
    setOpenBatchDownloadMenuId(null);
  }, [content, previewUrls, socialPlatform, tone]);


  const handleDownloadAllCsv = () => {
    if (batchResults.length === 0) return;
    const sanitize = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const header = ['Image_Filename', 'Metadata', 'Generated_Content'];
    const rows = batchResults.map(item => {
        const filename = sanitize(item.imageFile.name);
        const metadata = sanitize(item.metadata);
        const content = sanitize(item.content);
        return [filename, metadata, content].join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `picscripter-batch-${Date.now()}.csv`);
  };

  const renderSingleContent = () => {
    if (isLoading && !content) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
           <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300 transition-opacity duration-500">{currentLoadingPhrase}</p>
        </div>
      );
    }
    
    if (!content) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
          <SparklesIcon />
          <p className="mt-4 font-semibold">Your AI-generated content will appear here.</p>
          <p className="mt-1 text-sm">Upload an image to get started.</p>
        </div>
      );
    }
    return (
        <>
            {proofreadDiff ? (
                <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-300 text-sm md:text-base leading-relaxed break-words">
                  {proofreadDiff.map((part, index) => {
                    if (part.type === 'added') return <span key={index} className="bg-green-500/20 text-green-700 dark:text-green-300 rounded px-1">{part.value}</span>;
                    if (part.type === 'removed') return <span key={index} className="bg-red-500/20 text-red-700 dark:text-red-300 rounded px-1 line-through">{part.value}</span>;
                    return <span key={index}>{part.value}</span>;
                  })}
                </div>
            ) : (
                <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-300 text-sm md:text-base leading-relaxed break-words">{content}</div>
            )}
            {proofreadMessage && (
                <div className={`mt-3 p-2 rounded-md text-sm flex items-center justify-between ${
                    proofreadMessage.type === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-300' :
                    proofreadMessage.type === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-300' :
                    'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                }`}>
                    <span>{proofreadMessage.text}</span>
                    {proofreadDiff && proofreadMessage.type !== 'error' && proofreadHasCorrections && (
                        <button 
                            onClick={onAcceptProofread} 
                            className="ml-4 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap">
                            Accept Changes
                        </button>
                    )}
                </div>
            )}
            {!proofreadDiff && <CreativityScore />}
        </>
    );
  };
  
  const renderBatchContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <div className="w-full max-w-sm">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{loadingMessage}</p>
                <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }}></div>
                </div>
            </div>
            {batchResults.length > 0 && (
                <div className="w-full mt-6 space-y-3 overflow-y-auto max-h-[calc(100%-100px)]">
                    {batchResults.map(item => 
                      <BatchItemCard 
                        key={item.id} 
                        item={item} 
                        onSaveDraft={onSaveBatchItemAsDraft} 
                        onProofread={onProofreadBatchItem}
                        onDownloadItem={(batchItem, format) => handleDownload(format as DownloadFormat, { content: batchItem.content, previewUrls: [batchItem.previewUrl], id: batchItem.id })}
                        onSmartPostClick={onSmartPostBatchItemClick}
                        isDownloadMenuOpen={openBatchDownloadMenuId === item.id}
                        onToggleDownloadMenu={handleToggleBatchDownloadMenu}
                        onAcceptProofread={onAcceptProofreadBatchItem}
                      />
                    )}
                </div>
            )}
        </div>
      );
    }

    if (batchResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
          <SparklesIcon />
          <p className="mt-4 font-semibold">Batch results will appear here.</p>
          <p className="mt-1 text-sm">Upload images and generate to see results for each.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {batchResults.map(item => 
          <BatchItemCard 
            key={item.id} 
            item={item} 
            onSaveDraft={onSaveBatchItemAsDraft} 
            onProofread={onProofreadBatchItem}
            onDownloadItem={(batchItem, format) => handleDownload(format, { content: batchItem.content, previewUrls: [batchItem.previewUrl], id: batchItem.id })}
            onSmartPostClick={onSmartPostBatchItemClick}
            isDownloadMenuOpen={openBatchDownloadMenuId === item.id}
            onToggleDownloadMenu={handleToggleBatchDownloadMenu}
            onAcceptProofread={onAcceptProofreadBatchItem}
          />
        )}
      </div>
    );
  };

  const hasContent = isBatchMode ? batchResults.length > 0 : !!content;

  return (
    <div className="w-full h-full bg-white dark:bg-white/5 rounded-2xl p-4 sm:p-6 flex flex-col relative border border-gray-200 dark:border-white/20 backdrop-blur-lg shadow-2xl">
      <div className="flex-grow overflow-y-auto pr-2 relative">
         {isBatchMode ? renderBatchContent() : renderSingleContent()}
      </div>
      {hasContent && !isLoading && (
        <div className="flex-shrink-0 pt-4 mt-4 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
           {isBatchMode ? (
              <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-gray-500">{batchResults.length} results generated</p>
                <div className="flex items-center flex-wrap justify-center sm:justify-end gap-2">
                  <button 
                    onClick={handleDownloadAllCsv}
                    className="flex items-center justify-center h-9 px-4 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 rounded-lg transition-opacity font-semibold text-sm"
                  >
                    <DownloadIcon />
                    <span className="ml-2">Download All (CSV)</span>
                  </button>
                  <button 
                    onClick={onSaveAllAsDrafts}
                    className="flex items-center justify-center h-9 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 rounded-lg transition-opacity font-semibold text-sm"
                  >
                    <BookmarkIcon />
                    <span className="ml-2">Save All as Drafts</span>
                  </button>
                </div>
              </div>
           ) : (
            <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-500">Characters: {content.length}</p>
              <div className="flex items-center flex-wrap justify-center sm:justify-end gap-2">
                <Tooltip text={copied ? 'Copied!' : 'Copy'}>
                    <button onClick={handleCopy} className="flex items-center justify-center h-9 w-9 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors">
                        {copied ? <CheckCircleIcon /> : <ClipboardIcon />}
                    </button>
                </Tooltip>
                <div className="relative" ref={downloadMenuRef}>
                    <Tooltip text="Download">
                        <button 
                            onClick={handleToggleDownloadMenu} 
                            className="flex items-center justify-center h-9 w-9 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
                        >
                            <DownloadIcon />
                        </button>
                    </Tooltip>
                    {isDownloadMenuOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-52 bg-gray-800/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-600 dark:border-white/20 rounded-lg shadow-lg z-20 transition-opacity duration-200 opacity-100">
                            <ul className="py-1 text-sm text-gray-300 dark:text-gray-200">
                                <li onClick={() => handleDownload('pdf')} 
                                    className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center"
                                >
                                    Export as PDF
                                </li>
                                <li onClick={() => handleDownload('docx')}
                                    className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center"
                                >
                                    Export as Word (.docx)
                                </li>
                                <li onClick={() => handleDownload('html')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as HTML</li>
                                <li onClick={() => handleDownload('csv')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as CSV</li>
                                <li onClick={() => handleDownload('txt')} className="px-3 py-1.5 hover:bg-gray-700 dark:hover:bg-white/10 cursor-pointer flex items-center">Export as Text (.txt)</li>
                            </ul>
                        </div>
                    )}
                </div>
                 <Tooltip text="Regenerate">
                    <button onClick={onRegenerate} className="flex items-center justify-center h-9 w-9 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors">
                        <RegenerateIcon />
                    </button>
                </Tooltip>
                 <Tooltip text="Proofread">
                    <button
                        onClick={onProofread}
                        disabled={isProofreading || !content}
                        className="flex items-center justify-center h-9 w-9 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProofreading ? <SpinnerIcon /> : <ProofreadIcon />}
                    </button>
                </Tooltip>
                 <Tooltip text="Save as Draft">
                    <button onClick={onSaveDraft} className="flex items-center justify-center h-9 w-9 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors">
                        <BookmarkIcon />
                    </button>
                </Tooltip>
                <button 
                  onClick={onSmartPostClick}
                  className="flex items-center justify-center h-9 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 rounded-lg transition-opacity font-semibold text-sm"
                >
                  <SmartPostIcon />
                  <span className="ml-2">Smart Post</span>
                </button>
                </div>
            </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ContentDisplay;