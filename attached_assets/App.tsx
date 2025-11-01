import React, { useState, useEffect, useCallback } from 'react';
import { Category, HistoryItem, PromptTemplateParams, DiffEntry, BatchResultItem, Preset, Tone, PlatformInfo, PlatformKey } from './types';
import { CATEGORY_PROMPTS, API_BASE } from './constants';
import { generateDescription, proofreadText } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import CategorySelector from './components/CategorySelector';
import ContentDisplay from './components/ContentDisplay';
import HistoryPanel from './components/HistoryPanel';
import LanguageSelector from './components/LanguageSelector';
import SocialPlatformSelector from './components/SocialPlatformSelector';
import PresetManager from './components/PresetManager';
import SavePresetButton from './components/SavePresetButton';
import AutoSaveIndicator from './components/AutoSaveIndicator';
import SettingsModal from './components/SettingsModal';
import SmartPostModal from './components/SmartPostModal';
import AddressInput from './components/AddressInput';


const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

const convertImageToJpeg = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(objectUrl);
                if (!blob) {
                    return reject(new Error('Canvas toBlob failed to create a blob.'));
                }
                const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.jpeg';
                const newFile = new File([blob], newFileName, { type: 'image/jpeg', lastModified: Date.now() });
                resolve(newFile);
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load image file: ${file.name}`));
        };
    });
};

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const mimeType = blob.type;
    const extension = mimeType.split('/')[1] || 'jpeg';
    const finalFilename = filename.includes('.') ? filename : `${filename}.${extension}`;
    return new File([blob], finalFilename, { type: mimeType });
};


// --- ICONS ---
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>);
const FooterLinkedInIcon = () => (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.94 0-1.42.61-1.62 1.21-.07.21-.08.5-.08.79V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.1 1.16 3.1 3.74z"></path></svg>);
const FooterXIcon = () => (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>);
const FooterGitHubIcon = () => (<svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.03-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.398.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.577.688.48A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10z"></path></svg>);
const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);
const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);


// --- NEW UI COMPONENTS ---

const Header: React.FC<{ 
    onMenuClick: () => void; 
    onSettingsClick: () => void;
    onNewSessionClick: () => void;
    theme: 'dark' | 'light';
    onThemeChange: () => void;
}> = ({ onMenuClick, onSettingsClick, onNewSessionClick, theme, onThemeChange }) => (
    <header className="flex-shrink-0 h-16 bg-white/80 dark:bg-black/10 backdrop-blur-lg border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
            <button onClick={onMenuClick} className="lg:hidden text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors" aria-label="Open menu">
                <MenuIcon />
            </button>
            <h1 className="text-2xl font-bold tracking-tighter text-gray-900 dark:text-white" style={{ textShadow: '0 0 10px rgba(196, 181, 253, 0.5)' }}>
                Picscripter
            </h1>
            <button
                onClick={onNewSessionClick}
                className="hidden md:flex items-center justify-center text-center px-4 py-2 rounded-lg border-2 border-transparent bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-indigo-500 glow-effect"
            >
                <span className="font-semibold text-sm text-white">+ New Session</span>
            </button>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-600 dark:text-gray-300">
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors gradient-underline">Dashboard</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Templates</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">AI History</a>
            <button onClick={onSettingsClick} className="hover:text-black dark:hover:text-white transition-colors">Settings</button>
            <button onClick={onSettingsClick} className="px-4 py-2 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 text-gray-800 dark:text-gray-200 transition-colors">Connect Accounts</button>
            <button onClick={onThemeChange} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
        </nav>
        {/* Mobile actions */}
        <div className="flex items-center space-x-2 md:hidden">
            <button
                onClick={onNewSessionClick}
                className="flex items-center justify-center p-2 rounded-lg bg-indigo-500 text-white hover:opacity-90 transition-opacity"
                aria-label="New Session"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
            </button>
            <button onClick={onThemeChange} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
                 {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
        </div>
    </header>
);

const Footer = () => (
    <footer className="text-center py-4 text-gray-500 text-sm flex flex-col items-center space-y-3">
        <p>Built with ❤️ by Picscripter AI</p>
        <div className="flex items-center space-x-5">
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors" aria-label="LinkedIn">
                <FooterLinkedInIcon />
            </a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors" aria-label="X (Twitter)">
                <FooterXIcon />
            </a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors" aria-label="GitHub">
                <FooterGitHubIcon />
            </a>
        </div>
    </footer>
);


const StyleSettings: React.FC<{
    tone: Tone; onToneChange: (t: Tone) => void;
    addHashtags: boolean; onHashtagsChange: (c: boolean) => void;
    addEmojis: boolean; onEmojisChange: (c: boolean) => void;
    isDisabled: boolean;
}> = ({ tone, onToneChange, addHashtags, onHashtagsChange, addEmojis, onEmojisChange, isDisabled }) => (
    <div className="space-y-4">
        <div>
            <label htmlFor="tone-select" className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Tone</label>
            <select
                id="tone-select" value={tone} onChange={e => onToneChange(e.target.value as Tone)} disabled={isDisabled}
                className="appearance-none w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-xl py-2 px-3 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                {['Professional', 'Casual', 'Luxury', 'Playful', 'Motivational'].map(t => <option key={t} value={t} className="bg-white dark:bg-gray-800 text-black dark:text-white">{t}</option>)}
            </select>
        </div>
        <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
            <label htmlFor="hashtags-checkbox" className="flex items-center cursor-pointer">
                <input id="hashtags-checkbox" type="checkbox" checked={addHashtags} onChange={e => onHashtagsChange(e.target.checked)} disabled={isDisabled} className="h-4 w-4 rounded bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-indigo-600 focus:ring-indigo-500"/>
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Add Hashtags</span>
            </label>
            <label htmlFor="emojis-checkbox" className="flex items-center cursor-pointer">
                <input id="emojis-checkbox" type="checkbox" checked={addEmojis} onChange={e => onEmojisChange(e.target.checked)} disabled={isDisabled} className="h-4 w-4 rounded bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-indigo-600 focus:ring-indigo-500"/>
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Add Emojis</span>
            </label>
        </div>
    </div>
);


const App: React.FC = () => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>(Category.Travel);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [currentMetadata, setCurrentMetadata] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isProofreading, setIsProofreading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [language, setLanguage] = useState<string>('English');
  const [socialPlatform, setSocialPlatform] = useState<string>('Instagram');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [drafts, setDrafts] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  const [proofreadDiff, setProofreadDiff] = useState<DiffEntry[] | null>(null);
  const [proofreadMessage, setProofreadMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [proofreadHasCorrections, setProofreadHasCorrections] = useState<boolean>(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  
  // New state for redesigned UI
  const [tone, setTone] = useState<Tone>('Casual');
  const [addHashtags, setAddHashtags] = useState(true);
  const [addEmojis, setAddEmojis] = useState(true);
  const [showAutoSave, setShowAutoSave] = useState(false);
  const autoSaveTimeoutRef = React.useRef<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // New state for theme and modals
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSmartPostModalOpen, setIsSmartPostModalOpen] = useState(false);
  const [smartPostModalData, setSmartPostModalData] = useState<{ content: string; images: string[] } | null>(null);

  const [platforms, setPlatforms] = useState<PlatformInfo[]>([
    { key: "instagram", name: "Instagram", connected: true,  selectable: true,  testEndpoint: "/post_to_ig" },
    { key: "facebook",  name: "Facebook",  connected: true,  selectable: true,  testEndpoint: "/post_to_fb" },
    { key: "pinterest", name: "Pinterest", connected: true,  selectable: true,  testEndpoint: "/post_to_pinterest" },
    { key: "twitter",   name: "X/Twitter", connected: false, selectable: false },
    { key: "tiktok",    name: "TikTok",    connected: false, selectable: false },
    { key: "linkedin",  name: "LinkedIn",  connected: false, selectable: false },
    { key: "youtube",   name: "YouTube",   connected: false, selectable: false },
  ]);

  const handlePlatformConnectToggle = useCallback((key: PlatformKey) => {
    // This will be a fake toggle with a delay to simulate an async action
    setPlatforms(list => list.map(p => p.key === key ? { ...p, isConnecting: true } as any : p));

    setTimeout(() => {
        setPlatforms(list => list.map(p => p.key === key ? { ...p, connected: !p.connected, isConnecting: false } as any : p));
    }, 1000);
  }, []);

  useEffect(() => {
  fetch(`${API_BASE}/post_to_fb`, {

    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello from PicScripter Frontend 🚀" })
  })
    .then((res) => res.json())
    .then((data) => console.log("Backend says:", data))
    .catch((err) => console.error("Error:", err));
}, []);


  // Effects for theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('picscripter_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
    }
  }, []);

  useEffect(() => {
      if (theme === 'light') {
          document.documentElement.classList.remove('dark');
      } else {
          document.documentElement.classList.add('dark');
      }
      localStorage.setItem('picscripter_theme', theme);
  }, [theme]);
  
  const handleThemeChange = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };


  useEffect(() => {
    // This effect acts as our "auto-save" trigger
    const triggerAutoSaveIndicator = () => {
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        setShowAutoSave(true);
        autoSaveTimeoutRef.current = window.setTimeout(() => setShowAutoSave(false), 2000);
    };
    triggerAutoSaveIndicator();

    try {
      const draftsToSave = drafts.map(({ imageFiles, ...rest }) => ({ ...rest, imageFiles: [] }));
      localStorage.setItem('picscripter_drafts', JSON.stringify(draftsToSave));
      localStorage.setItem('picscripter_presets', JSON.stringify(presets));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
    
    return () => {
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    }

  }, [drafts, presets]);


  useEffect(() => {
    try {
      const savedDrafts = localStorage.getItem('picscripter_drafts');
      if (savedDrafts) {
        const parsedDrafts: HistoryItem[] = JSON.parse(savedDrafts);
        parsedDrafts.sort((a, b) => b.id - a.id);
        parsedDrafts.forEach(draft => {
            draft.imageFiles = [];
            if (!draft.previewUrls) draft.previewUrls = [];
        }); 
        setDrafts(parsedDrafts);
      }
      const savedPresets = localStorage.getItem('picscripter_presets');
      if (savedPresets) {
        const parsedPresets: Preset[] = JSON.parse(savedPresets);
        parsedPresets.sort((a, b) => a.name.localeCompare(b.name));
        setPresets(parsedPresets);
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }
  }, []);
  
  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleClearContent();
      setError(null);
      const newFiles = Array.from(files);
      const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      try {
        const processedFilesPromises = newFiles.map((file: File) => 
            supportedMimeTypes.includes(file.type) ? Promise.resolve(file) : convertImageToJpeg(file)
        );
        const processedFiles = await Promise.all(processedFilesPromises);
        setImageFiles(prev => [...prev, ...processedFiles]);
        const newPreviewUrls = await Promise.all(processedFiles.map(fileToDataUrl));
        setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
      } catch (conversionError) {
        console.error("Failed to process image:", conversionError);
        setError("An error occurred while processing an image. Please try a different image.");
      } finally {
        event.target.value = '';
      }
    }
  };

  const handleClearImages = () => {
    setImageFiles([]);
    setPreviewUrls([]);
    handleClearContent();
  };

  const handleDeleteImage = (indexToDelete: number) => {
    setImageFiles(prev => prev.filter((_, index) => index !== indexToDelete));
    setPreviewUrls(prev => prev.filter((_, index) => index !== indexToDelete));
    handleClearContent();
  };
  
  const handleReorderImages = useCallback((dragIndex: number, hoverIndex: number) => {
    setImageFiles(prev => {
        const reordered = [...prev];
        const [dragged] = reordered.splice(dragIndex, 1);
        reordered.splice(hoverIndex, 0, dragged);
        return reordered;
    });
    setPreviewUrls(prev => {
        const reordered = [...prev];
        const [dragged] = reordered.splice(dragIndex, 1);
        reordered.splice(hoverIndex, 0, dragged);
        return reordered;
    });
  }, []);

  const handleClearContent = () => {
    setGeneratedContent('');
    setBatchResults([]);
    setCurrentMetadata('');
    setSelectedHistoryId(null);
    setProofreadDiff(null);
    setProofreadMessage(null);
    setProofreadHasCorrections(false);
  };
  
  const handleNewSession = () => {
    handleClearImages();
    setError(null);
    setCustomPrompt('');
    setAddress('');
    setCategory(Category.Travel);
    setLanguage('English');
    setSocialPlatform('Instagram');
    setTone('Casual');
    setAddHashtags(true);
    setAddEmojis(true);
    setSelectedPresetName('');
    setIsSidebarOpen(false);
    setIsBatchMode(false);
    setProofreadDiff(null);
    setProofreadMessage(null);
    setProofreadHasCorrections(false);
    setIsEditingDraft(false);
  };

  const handleSelectHistoryItem = useCallback((id: number) => {
    const item = drafts.find(d => d.id === id);
    if (item) {
        setSelectedHistoryId(item.id);
        setGeneratedContent(item.content);
        setCurrentMetadata(item.metadata || '');
        setCategory(item.category);
        setPreviewUrls(item.previewUrls);
        if (item.previewUrls.length > 0) {
            setImageFiles([]); // Clear old files immediately
            Promise.all(item.previewUrls.map((url, i) => dataUrlToFile(url, `image_${item.id}_${i}`)))
                   .then(setImageFiles);
        } else {
             setImageFiles([]);
        }
        setCustomPrompt(item.customPrompt);
        setAddress(item.address || '');
        setLanguage(item.language || 'English');
        setSocialPlatform(item.socialPlatform || 'Instagram');
        setTone(item.tone || 'Casual');
        setAddHashtags(item.addHashtags !== false);
        setAddEmojis(item.addEmojis !== false);
        setIsLoading(false);
        setError(null);
        setSelectedPresetName('');
        setIsBatchMode(false);
        setIsSidebarOpen(false); // Close sidebar on selection
        setProofreadDiff(null);
        setProofreadMessage(null);
        setProofreadHasCorrections(false);
    }
  }, [drafts]);

  const handleDeleteDraftItem = (id: number) => {
      if (selectedHistoryId === id) handleNewSession();
      setDrafts(prev => prev.filter(item => item.id !== id));
  };

  const handleClearDrafts = () => {
      if(drafts.some(d => d.id === selectedHistoryId)) handleNewSession();
      setDrafts([]);
  };

  const handleSaveDraft = () => {
    if (!generatedContent || imageFiles.length === 0) return;
    const newDraft: HistoryItem = {
      id: Date.now(),
      content: generatedContent,
      metadata: currentMetadata,
      category,
      imageFiles: imageFiles, 
      previewUrls: previewUrls,
      customPrompt, 
      address: address, 
      language, 
      socialPlatform,
      tone, 
      addHashtags, 
      addEmojis,
      isDraft: true,
    };
    if (!drafts.some(d => d.content === newDraft.content && d.previewUrls[0] === newDraft.previewUrls[0])) {
      setDrafts(prev => [newDraft, ...prev]);
      setSelectedHistoryId(newDraft.id);
    }
  };

  const handleSaveBatchItemAsDraft = (item: BatchResultItem) => {
    const newDraft: HistoryItem = {
      id: Date.now(),
      content: item.content,
      metadata: item.metadata,
      category,
      previewUrls: [item.previewUrl],
      imageFiles: [item.imageFile],
      customPrompt, 
      address: address, 
      language, 
      socialPlatform, 
      tone, 
      addHashtags, 
      addEmojis,
      isDraft: true,
    };
    if (!drafts.some(d => d.content === newDraft.content && d.previewUrls[0] === newDraft.previewUrls[0])) {
      setDrafts(prev => [newDraft, ...prev]);
    }
  };

  const handleSaveAllAsDrafts = () => {
    batchResults.forEach(handleSaveBatchItemAsDraft);
  };
  
  const generateContent = useCallback(async () => {
    if (imageFiles.length === 0) return;

    setIsLoading(true);
    setProofreadDiff(null);
    setProofreadMessage(null);
    setError(null);
     if (!isBatchMode) {
        setGeneratedContent('');
        setCurrentMetadata('');
    } else {
        setBatchResults([]);
    }
    setGenerationProgress(0);

    const promptParams: PromptTemplateParams = {
      address: category === Category.RealEstate ? address.trim() || undefined : undefined,
      customPrompt: customPrompt.trim() || undefined,
      language, socialPlatform, tone, addHashtags, addEmojis
    };
    const finalPrompt = CATEGORY_PROMPTS[category](promptParams);

    try {
      if (isBatchMode) {
        const results: BatchResultItem[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const url = previewUrls[i];
          setLoadingMessage(`Generating for image ${i + 1} of ${imageFiles.length}...`);
          const { description, metadata } = await generateDescription([file], finalPrompt);
          results.push({ id: `${Date.now()}-${i}`, content: description, metadata, previewUrl: url, imageFile: file });
          setBatchResults([...results]);
          setGenerationProgress(((i + 1) / imageFiles.length) * 100);
        }
      } else {
        const { description, metadata } = await generateDescription(imageFiles, finalPrompt);
        setGeneratedContent(description);
        setCurrentMetadata(metadata);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setGeneratedContent(`Failed to generate content: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [imageFiles, previewUrls, isBatchMode, category, customPrompt, address, language, socialPlatform, tone, addHashtags, addEmojis]);
  
  const handleProofread = async () => {
    if (!generatedContent || isProofreading) return;
    setIsProofreading(true);
    setProofreadDiff(null);
    setProofreadMessage(null);
    setProofreadHasCorrections(false);
    try {
        const result = await proofreadText(generatedContent);
        setGeneratedContent(result.correctedText);
        setProofreadDiff(result.diff);
        setProofreadHasCorrections(result.hasCorrections);
        let messageType: 'success' | 'info' | 'error' = result.hasCorrections ? 'success' : 'info';
        if (result.changesSummary.startsWith('Proofreading Failed:')) {
            messageType = 'error';
        }
        setProofreadMessage({ 
            text: result.changesSummary, 
            type: messageType
        });
    } catch (error) {
        console.error("Proofreading failed:", error);
        setProofreadMessage({ text: "An error occurred during proofreading.", type: 'error' });
    } finally {
        setIsProofreading(false);
    }
  };

  const handleAcceptProofread = () => {
    setProofreadDiff(null);
    setProofreadMessage(null);
    setProofreadHasCorrections(false);
  };

  const handleProofreadBatchItem = async (itemId: string) => {
      const itemToProofread = batchResults.find(item => item.id === itemId);
      if (!itemToProofread) return;

      setBatchResults(prev => prev.map(item => item.id === itemId ? { ...item, isProofreading: true } : item));

      try {
        const result = await proofreadText(itemToProofread.content);
        setBatchResults(prev => prev.map(item => item.id === itemId ? {
          ...item,
          isProofreading: false,
          content: result.correctedText,
          proofreadMessage: { text: result.changesSummary, type: result.hasCorrections ? 'success' : 'info' },
          proofreadDiff: result.diff,
          hasCorrections: result.hasCorrections,
        } : item));
      } catch (error) {
        console.error("Proofreading failed for item", itemId, error);
        setBatchResults(prev => prev.map(item => item.id === itemId ? {
          ...item,
          isProofreading: false,
          proofreadMessage: { text: "Proofreading failed.", type: 'error' }
        } : item));
      }
  };

  const handleAcceptProofreadBatchItem = (itemId: string) => {
    setBatchResults(prev => prev.map(item => 
        item.id === itemId 
            ? { ...item, proofreadDiff: null, proofreadMessage: null, hasCorrections: false } 
            : item
    ));
  };

  const handleSavePreset = (name: string) => {
    const newPreset: Preset = { name, category, language, socialPlatform, customPrompt, tone, addHashtags, addEmojis };
    setPresets(prev => [...prev, newPreset].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedPresetName(newPreset.name);
  };

  const handleApplyPreset = (name: string) => {
    setSelectedPresetName(name);
    const preset = presets.find(p => p.name === name);
    if (preset) {
      setCategory(preset.category);
      setLanguage(preset.language);
      setSocialPlatform(preset.socialPlatform);
      setCustomPrompt(preset.customPrompt);
      setTone(preset.tone);
      setAddHashtags(preset.addHashtags);
      setAddEmojis(preset.addEmojis);
      setIsSidebarOpen(false); // Close sidebar on apply
    }
  };

  const handleDeletePreset = (name: string) => {
    setPresets(prev => prev.filter(p => p.name !== name));
    if (selectedPresetName === name) setSelectedPresetName('');
  };

  const handleSmartPostClick = () => {
    setSmartPostModalData({ content: generatedContent, images: previewUrls });
    setIsSmartPostModalOpen(true);
  };

  const handleSmartPostBatchItemClick = (item: BatchResultItem) => {
    setSmartPostModalData({ content: item.content, images: [item.previewUrl] });
    setIsSmartPostModalOpen(true);
  };

  const isUiLocked = isLoading || isSaving || isProofreading;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0F111A] text-gray-900 dark:text-white font-sans flex-col overflow-hidden">
      <Header 
        onMenuClick={() => setIsSidebarOpen(true)} 
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        theme={theme}
        onThemeChange={handleThemeChange} 
        onNewSessionClick={handleNewSession}
      />
      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true"></div>
        )}
        <aside className={`fixed lg:relative inset-y-0 left-0 z-40 w-80 bg-gray-50 dark:bg-[#0F111A] lg:bg-white lg:dark:bg-black/10 flex-shrink-0 p-4 flex flex-col space-y-4 border-r border-gray-200 dark:border-white/10 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
            <HistoryPanel
                history={[]} // History is now part of drafts
                drafts={drafts}
                selectedHistoryId={selectedHistoryId}
                onSelectItem={handleSelectHistoryItem}
                onDeleteItem={() => {}} // Not implemented in this design
                onDeleteDraftItem={handleDeleteDraftItem}
                onClearHistory={() => {}} // Not implemented in this design
                onClearDrafts={handleClearDrafts}
            />
            <PresetManager
                presets={presets}
                selectedPresetName={selectedPresetName}
                onApply={handleApplyPreset}
                onDelete={handleDeletePreset}
                isDisabled={isUiLocked}
            />
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Inputs */}
              <div className="flex flex-col space-y-6">
                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Step 1: Category</h3>
                  <CategorySelector selectedCategory={category} onCategoryChange={setCategory} isDisabled={isUiLocked} />
                </div>
                
                {category === Category.RealEstate && (
                  <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 animate-in fade-in-0 duration-300">
                    <AddressInput
                      address={address}
                      onAddressChange={setAddress}
                      isDisabled={isUiLocked}
                    />
                  </div>
                )}

                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Step 2: Language & Platform</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} isDisabled={isUiLocked} />
                    <SocialPlatformSelector selectedPlatform={socialPlatform} onPlatformChange={setSocialPlatform} isDisabled={isUiLocked} />
                  </div>
                </div>
                
                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Step 3: Style</h3>
                  <StyleSettings 
                    tone={tone} onToneChange={setTone}
                    addHashtags={addHashtags} onHashtagsChange={setAddHashtags}
                    addEmojis={addEmojis} onEmojisChange={setAddEmojis}
                    isDisabled={isUiLocked}
                  />
                </div>
                
                <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">Step 4: Additional Instructions</h3>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Add extra context ( product details, square footage, weight, size, milage)"
                    className="w-full h-24 p-3 bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-800 dark:text-gray-300 placeholder-gray-500 resize-none"
                    disabled={isUiLocked}
                  />
                </div>
                 <SavePresetButton presets={presets} onSave={handleSavePreset} isDisabled={isUiLocked} />
              </div>

              {/* Right Column: Uploader & Output */}
              <div className="flex flex-col space-y-6">
                  <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">Step 5: Upload Image(s)</h3>
                        <label htmlFor="batch-mode-toggle" className="flex items-center cursor-pointer">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-3">Batch Mode</span>
                            <div className="relative">
                                <input
                                    id="batch-mode-toggle"
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isBatchMode}
                                    onChange={(e) => setIsBatchMode(e.target.checked)}
                                    disabled={isUiLocked}
                                />
                                <div className={`block w-12 h-6 rounded-full transition ${isBatchMode ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isBatchMode ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                      </div>
                      <ImageUploader 
                        onImageChange={handleImageChange}
                        previewUrls={previewUrls}
                        isLoading={isLoading}
                        onClearImages={handleClearImages}
                        onDeleteImage={handleDeleteImage}
                        onReorderImages={handleReorderImages}
                      />
                  </div>
                  
                   <button
                        onClick={generateContent}
                        disabled={isUiLocked || imageFiles.length === 0}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-indigo-500 glow-effect"
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : "✨ Generate Description"}
                    </button>
                    
                  <ContentDisplay 
                      content={generatedContent} 
                      batchResults={batchResults}
                      isBatchMode={isBatchMode}
                      isLoading={isLoading} 
                      loadingMessage={loadingMessage}
                      generationProgress={generationProgress}
                      previewUrls={previewUrls}
                      onClearContent={handleClearContent}
                      onSaveDraft={handleSaveDraft}
                      onSaveBatchItemAsDraft={handleSaveBatchItemAsDraft}
                      onSaveAllAsDrafts={handleSaveAllAsDrafts}
                      isDraftSelected={!!selectedHistoryId}
                      isEditing={isEditingDraft}
                      onEditDraft={() => {}}
                      onUpdateDraft={() => {}}
                      isSaving={isSaving}
                      hasImages={imageFiles.length > 0}
                      onRegenerate={generateContent}
                      onProofread={handleProofread}
                      onProofreadBatchItem={handleProofreadBatchItem}
                      isProofreading={isProofreading}
                      proofreadMessage={proofreadMessage}
                      proofreadDiff={proofreadDiff}
                      proofreadHasCorrections={proofreadHasCorrections}
                      tone={tone}
                      socialPlatform={socialPlatform}
                      onSmartPostClick={handleSmartPostClick}
                      onSmartPostBatchItemClick={handleSmartPostBatchItemClick}
                      onAcceptProofread={handleAcceptProofread}
                      onAcceptProofreadBatchItem={handleAcceptProofreadBatchItem}
                    />
                     {showAutoSave && <div className="fixed bottom-6 right-6 z-50"><AutoSaveIndicator /></div>}
              </div>
          </div>
          <Footer />
        </main>
      </div>
      <SettingsModal 
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          platforms={platforms}
          onPlatformConnectToggle={handlePlatformConnectToggle}
      />
       <SmartPostModal 
          isOpen={isSmartPostModalOpen}
          onClose={() => {
            setIsSmartPostModalOpen(false);
            setSmartPostModalData(null);
          }}
          content={smartPostModalData?.content ?? ''}
          images={smartPostModalData?.images ?? []}
          platforms={platforms}
          onPlatformConnectToggle={handlePlatformConnectToggle}
      />
    </div>
  );
};

export default App;