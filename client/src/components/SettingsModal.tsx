import React from 'react';
import { PlatformInfo, PlatformKey } from '../types';

// --- ICONS ---
const InstagramIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
const FacebookIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.87v-2.782h2.87V9.617c0-2.863 1.706-4.436 4.312-4.436 1.225 0 2.475.225 2.475.225v2.37h-1.22c-1.42 0-1.875.87-1.875 1.79v2.14h3.18l-.5 2.783h-2.68V21.878A10.002 10.002 0 0022 12z"></path></svg>;
const TikTokIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.03-4.63-1.1-6.16-2.96-1.3-1.59-1.94-3.58-1.78-5.51.12-1.46.63-2.88 1.48-4.14.96-1.41 2.37-2.39 3.99-2.73.01 2.05-.01 4.1.02 6.15-.02 1.05.15 2.12.59 3.09.43.97 1.1 1.83 1.95 2.44.85.6 1.88.94 2.96.94.99 0 1.97-.24 2.82-.72.85-.48 1.56-1.21 2.02-2.11.47-.9.69-1.95.66-2.99-.02-3.18.02-6.36-.01-9.54-1.22.27-2.39.78-3.35 1.58-1.22 1.04-2.13 2.38-2.58 3.86-.17.56-.33 1.13-.48 1.71-.14-.23-.28-.47-.42-.7-.59-1.01-1.35-1.89-2.27-2.61-1.12-.87-2.46-1.4-3.87-1.57V.02c.01.01 0 .01 0 0z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
const LinkedInIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.94 0-1.42.61-1.62 1.21-.07.21-.08.5-.08.79V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.1 1.16 3.1 3.74z"></path></svg>;
const PinterestIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.633 7.844 6.305 9.282.022-.262.003-1.028.23-1.932.22-.888 1.41-5.954 1.41-5.954.24-.984-.42-1.74-.96-1.74-1.22 0-1.84.93-1.84 2.1 0 .78.27 1.62.61 2.21.33.58.42 1.11.3 1.71-.12.58-.38 1.18-.58 1.83-.07.23-.28.34-.5.21-1.2-.72-1.95-2.6-1.95-4.22 0-2.9 2.14-5.25 5.53-5.25 2.92 0 4.83 2.18 4.83 4.5 0 2.8-1.5 5-3.6 5-1.1 0-1.94-.57-2.26-1.25-.13-.27-.22-.55-.22-.86 0-.48.18-1 .35-1.43.2-.5.5-.96.5-1.4 0-.6-.3-1.07-.86-1.07-1 0-1.82.97-1.82 2.3 0 .82.3 1.34.3 1.34s-.6 2.5-.72 3c-.15.65-.08 1.37.2 1.94.28.58.98 1.1 1.93 1.1 2.4 0 4.14-3.1 4.14-6.42 0-2.4-1.5-4.14-4.25-4.14-2.8 0-5 2.1-5 4.8 0 .83.3 1.6.72 2.12.04.05.08.1.12.16l-.2 1.05c-.05.23-.2.27-.3.16-1.3-1.3-1.9-3.2-1.9-5.2 0-3.5 2.8-6.5 7.4-6.5 3.9 0 6.9 2.8 6.9 6.2 0 4-2.4 7-5.8 7-.8 0-1.5-.2-2.1-.5l-.3-.15s-.4.6-.5 1.2c-.1.6-.2 1.2-.2 1.8.02.5-.05 1-.1 1.4.15 3.3 2.1 5.9 5.2 5.9 3.5 0 6.5-2.9 6.5-6.5C22 6.477 17.523 2 12 2z" /></svg>;
const YouTubeIcon = () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg>;
const SpinnerIcon = () => <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;

const platformIcons: Record<string, React.ReactNode> = {
  Instagram: <InstagramIcon />,
  Facebook: <FacebookIcon />,
  TikTok: <TikTokIcon />,
  'X/Twitter': <XIcon />,
  LinkedIn: <LinkedInIcon />,
  Pinterest: <PinterestIcon />,
  YouTube: <YouTubeIcon />,
};


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platforms: (PlatformInfo & { isConnecting?: boolean })[];
  onPlatformConnectToggle: (key: PlatformKey) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, platforms, onPlatformConnectToggle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in-0" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true"></div>
      <div className="relative bg-gray-100 dark:bg-gray-800 rounded-2xl w-full max-w-md flex flex-col border border-gray-300 dark:border-gray-600 shadow-2xl shadow-indigo-500/10">
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Connected Accounts</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your connected social media accounts to enable Smart Posting.</p>
          <div className="space-y-3 pt-2">
            {platforms.map((p) => (
              <div key={p.key} className="flex items-center justify-between p-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                    <span className="text-gray-700 dark:text-gray-300">{platformIcons[p.name]}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                </div>
                <button
                    onClick={() => onPlatformConnectToggle(p.key)}
                    disabled={(p as any).isConnecting}
                    className={`w-28 text-sm font-semibold py-1.5 px-3 rounded-md transition-colors flex items-center justify-center
                        ${p.connected
                            ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30'
                            : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30'
                        }
                        disabled:opacity-50 disabled:cursor-wait
                    `}
                >
                    {(p as any).isConnecting ? <SpinnerIcon /> : (p.connected ? 'Disconnect' : 'Connect')}
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsModal;