
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from "../constants";
import { PlatformInfo, PlatformKey } from '../types';

interface SmartPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  images: string[];
  platforms: PlatformInfo[];
  onPlatformConnectToggle: (key: PlatformKey) => void;
}

type PostStatus = 'idle' | 'queued' | 'posting' | 'published' | 'failed';

// --- ICONS ---
const InstagramIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
const FacebookIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.87v-2.782h2.87V9.617c0-2.863 1.706-4.436 4.312-4.436 1.225 0 2.475.225 2.475.225v2.37h-1.22c-1.42 0-1.875.87-1.875 1.79v2.14h3.18l-.5 2.783h-2.68V21.878A10.002 10.002 0 0022 12z"></path></svg>;
const TikTokIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.03-4.63-1.1-6.16-2.96-1.3-1.59-1.94-3.58-1.78-5.51.12-1.46.63-2.88 1.48-4.14.96-1.41 2.37-2.39 3.99-2.73.01 2.05-.01 4.1.02 6.15-.02 1.05.15 2.12.59 3.09.43.97 1.1 1.83 1.95 2.44.85.6 1.88.94 2.96.94.99 0 1.97-.24 2.82-.72.85-.48 1.56-1.21 2.02-2.11.47-.9.69-1.95.66-2.99-.02-3.18.02-6.36-.01-9.54-1.22.27-2.39.78-3.35 1.58-1.22 1.04-2.13 2.38-2.58 3.86-.17.56-.33 1.13-.48 1.71-.14-.23-.28-.47-.42-.7-.59-1.01-1.35-1.89-2.27-2.61-1.12-.87-2.46-1.4-3.87-1.57V.02c.01.01 0 .01 0 0z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const LinkedInIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.94 0-1.42.61-1.62 1.21-.07.21-.08.5-.08.79V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.1 1.16 3.1 3.74z"></path></svg>;
const PinterestIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.633 7.844 6.305 9.282.022-.262.003-1.028.23-1.932.22-.888 1.41-5.954 1.41-5.954.24-.984-.42-1.74-.96-1.74-1.22 0-1.84.93-1.84 2.1 0 .78.27 1.62.61 2.21.33.58.42 1.11.3 1.71-.12.58-.38 1.18-.58 1.83-.07.23-.28.34-.5.21-1.2-.72-1.95-2.6-1.95-4.22 0-2.9 2.14-5.25 5.53-5.25 2.92 0 4.83 2.18 4.83 4.5 0 2.8-1.5 5-3.6 5-1.1 0-1.94-.57-2.26-1.25-.13-.27-.22-.55-.22-.86 0-.48.18-1 .35-1.43.2-.5.5-.96.5-1.4 0-.6-.3-1.07-.86-1.07-1 0-1.82.97-1.82 2.3 0 .82.3 1.34.3 1.34s-.6 2.5-.72 3c-.15.65-.08 1.37.2 1.94.28.58.98 1.1 1.93 1.1 2.4 0 4.14-3.1 4.14-6.42 0-2.4-1.5-4.14-4.25-4.14-2.8 0-5 2.1-5 4.8 0 .83.3 1.6.72 2.12.04.05.08.1.12.16l-.2 1.05c-.05.23-.2.27-.3.16-1.3-1.3-1.9-3.2-1.9-5.2 0-3.5 2.8-6.5 7.4-6.5 3.9 0 6.9 2.8 6.9 6.2 0 4-2.4 7-5.8 7-.8 0-1.5-.2-2.1-.5l-.3-.15s-.4.6-.5 1.2c-.1.6-.2 1.2-.2 1.8.02.5-.05 1-.1 1.4.15 3.3 2.1 5.9 5.2 5.9 3.5 0 6.5-2.9 6.5-6.5C22 6.477 17.523 2 12 2z" /></svg>;
const YouTubeIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg>;
const SpinnerIcon = () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const CheckIcon = () => <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const QueuedIcon = () => <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>;
const FailedIcon = () => <svg className="w-4 h-4 mr-1.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;

const platformIcons: Record<string, React.ReactNode> = {
  Instagram: <InstagramIcon />,
  Facebook: <FacebookIcon />,
  TikTok: <TikTokIcon />,
  'X/Twitter': <XIcon />,
  LinkedIn: <LinkedInIcon />,
  Pinterest: <PinterestIcon />,
  YouTube: <YouTubeIcon />,
};

// --- STATUS COMPONENT ---
const StatusIndicator: React.FC<{ status: PostStatus; platformUrl?: string }> = ({ status, platformUrl }) => {
  const baseClasses = 'px-2 py-0.5 text-xs font-medium rounded-full flex items-center';
  switch (status) {
    case 'queued': return <span className={`${baseClasses} bg-gray-500/20 text-gray-500 dark:text-gray-400`}><QueuedIcon />Queued</span>;
    case 'posting': return <span className={`${baseClasses} bg-yellow-500/20 text-yellow-500 dark:text-yellow-400`}><SpinnerIcon />Posting...</span>;
    case 'failed': return <span className={`${baseClasses} bg-red-500/20 text-red-500 dark:text-red-400`}><FailedIcon />Failed</span>;
    case 'published': return (
      <div className="flex items-center space-x-2">
        <span className={`${baseClasses} bg-green-500/20 text-green-600 dark:text-green-400`}><CheckIcon />Published</span>
        {platformUrl && 
          <a href={platformUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-semibold hover:underline">
            View Post
          </a>
        }
      </div>
    );
    default: return null;
  }
};

const SmartPostModal: React.FC<SmartPostModalProps> = ({ isOpen, onClose, content, images, platforms, onPlatformConnectToggle }) => {
  const [selected, setSelected] = useState<Partial<Record<PlatformKey, boolean>>>({});
  const [posting, setPosting] = useState(false);
  const [postStatuses, setPostStatuses] = useState<Partial<Record<PlatformKey, PostStatus>>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string | undefined>>({});
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [allPostsDone, setAllPostsDone] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState<PlatformKey | null>(null);

  useEffect(() => {
    const selectedPlatforms = platforms.filter(p => selected[p.key]);
    if (selectedPlatforms.length > 0) {
        if (!activeTabKey || !selected[activeTabKey]) {
            setActiveTabKey(selectedPlatforms[0].key);
        }
    } else {
        setActiveTabKey(null);
    }
  }, [selected, platforms, activeTabKey]);

  const toggleSelect = (key: PlatformKey) => {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const handlePost = async () => {
    setPosting(true);
    setAllPostsDone(false);

    const toPost = platforms.filter(
      (p) => selected[p.key] && p.connected && p.selectable && p.testEndpoint
    );
    
    setPostStatuses(prev => {
      const next = { ...prev };
      toPost.forEach(p => { next[p.key] = 'queued'; });
      return next;
    });
  
    for (const p of toPost) {
      setPostStatuses(prev => ({...prev, [p.key]: 'posting' as PostStatus}));
      try {
        const url = `${API_BASE}${p.testEndpoint ?? ""}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Test post from PicScripter → ${p.name}` }),
        });

        if (res.ok) {
          setPostStatuses(prev => ({...prev, [p.key]: 'published' as PostStatus}));
        } else {
          let errorText = `HTTP ${res.status}`;
          try {
            errorText = await res.text();
          } catch {
            // ignore if reading text fails
          }
          console.error("Post failed:", p.name, res.status, errorText);
          setPostStatuses(prev => ({...prev, [p.key]: 'failed' as PostStatus}));
        }
      } catch (e: any) {
        console.error("Post threw an exception:", p.name, e);
        setPostStatuses(prev => ({...prev, [p.key]: 'failed' as PostStatus}));
      }
    }
  
    setPosting(false);
    setAllPostsDone(true);
  };

  const handleClose = useCallback(() => {
    setPostStatuses({});
    setSelected({});
    setActiveTabKey(null);
    setPosting(false);
    setAllPostsDone(false);
    setScheduleMessage(null);
    setIsScheduling(false);
    setScheduleDateTime('');
    setEditedContent({});
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const enabledPlatforms = platforms.filter(p => selected[p.key]);

  const renderContentEditor = () => {
    if (enabledPlatforms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 p-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                <p className="mt-4 font-semibold">Select a platform</p>
                <p className="mt-1 text-sm">Choose one or more social media platforms from the left to start customizing your post.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-2 p-2 overflow-x-auto no-scrollbar" aria-label="Tabs">
                    {enabledPlatforms.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setActiveTabKey(p.key)}
                            className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                                activeTabKey === p.key
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            {platformIcons[p.name]}
                            <span className="ml-2">{p.name}</span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {activeTabKey && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                             {images.map((url, index) => (
                                <img key={index} src={url} alt={`Preview ${index + 1}`} className="w-full h-auto object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                             ))}
                         </div>
                         <textarea
                            value={editedContent[activeTabKey] ?? content}
                            onChange={e => setEditedContent(prev => ({...prev, [activeTabKey!]: e.target.value}))}
                            className="w-full h-full min-h-[200px] p-3 bg-gray-100 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-800 dark:text-gray-300 placeholder-gray-500 resize-none"
                            disabled={posting}
                        />
                    </div>
                )}
            </div>
        </div>
    );
  };
  
  const renderStatusView = () => (
    <div className="p-6 h-full flex flex-col justify-center">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 text-center">Posting Progress</h3>
        <ul className="space-y-4">
            {Object.entries(postStatuses).map(([platformKey, status]) => {
                const platformInfo = platforms.find(p => p.key === platformKey);
                if (!platformInfo) return null;
                return (
                    <li key={platformKey} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg">
                        <div className="flex items-center">
                            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white">{platformIcons[platformInfo.name]}</div>
                            <span className="ml-3 font-medium text-gray-800 dark:text-gray-200">{platformInfo.name}</span>
                        </div>
                        <StatusIndicator status={status} />
                    </li>
                );
            })}
        </ul>
        {allPostsDone && (
            <div className="text-center mt-8">
                <p className="text-green-600 dark:text-green-400 font-semibold mb-4">All posts have been processed!</p>
                <button onClick={handleClose} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    Close
                </button>
            </div>
        )}
         {scheduleMessage && (
            <div className="text-center mt-8">
                <p className="text-green-600 dark:text-green-400 font-semibold">{scheduleMessage}</p>
            </div>
        )}
    </div>
  );

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
      <div onClick={handleClose} className="absolute inset-0" aria-hidden="true"></div>
      <div className={`relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col border border-gray-300 dark:border-gray-600 shadow-2xl shadow-indigo-500/10 transition-transform ${isOpen ? 'scale-100' : 'scale-95'}`}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Smart Post</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
          <div className="col-span-1 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">1. Select Platforms</h3>
            <div className="space-y-3">
              {platforms.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!p.selectable || !p.connected || posting}
                      checked={!!selected[p.key]}
                      onChange={() => toggleSelect(p.key)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700"
                    />
                    <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                  </label>

                  {!p.connected ? (
                    <button
                      type="button"
                      onClick={() => onPlatformConnectToggle(p.key)}
                      disabled={!p.selectable}
                      className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Connect
                    </button>
                  ) : (
                    <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1 md:col-span-2 flex flex-col">
            <div className="flex-1 overflow-hidden">
              {Object.keys(postStatuses).length > 0 || scheduleMessage ? renderStatusView() : renderContentEditor()}
            </div>
            
            {Object.keys(postStatuses).length === 0 && !scheduleMessage && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <label htmlFor="schedule-toggle" className="flex items-center cursor-pointer">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-3">Schedule for later</span>
                                <div className="relative">
                                    <input id="schedule-toggle" type="checkbox" className="sr-only" checked={isScheduling} onChange={(e) => setIsScheduling(e.target.checked)} disabled={posting} />
                                    <div className={`block w-12 h-6 rounded-full transition ${isScheduling ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isScheduling ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                            </label>
                            {isScheduling && <input type="datetime-local" value={scheduleDateTime} onChange={e => setScheduleDateTime(e.target.value)} className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm text-gray-800 dark:text-gray-200" />}
                        </div>
                       <button
                          onClick={handlePost}
                          disabled={!selectedCount || posting}
                          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                        >
                          {posting ? <><SpinnerIcon /> <span className="ml-2">Posting...</span></> : `Post to ${selectedCount} Platform${selectedCount === 1 ? "" : "s"}`}
                        </button>
                    </div>
                </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SmartPostModal;