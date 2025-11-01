import React from 'react';

const platforms = [
  'Instagram', 'TikTok', 'YouTube', 'Facebook', 'Pinterest', 'X (Twitter)', 'LinkedIn',
];

interface SocialPlatformSelectorProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  isDisabled: boolean;
}

const SocialPlatformSelector: React.FC<SocialPlatformSelectorProps> = ({ selectedPlatform, onPlatformChange, isDisabled }) => {
  return (
    <div className="flex flex-col w-full">
      <label htmlFor="platform-select" className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        Platform
      </label>
      <div className="relative">
        <select
          id="platform-select"
          value={selectedPlatform}
          onChange={(e) => onPlatformChange(e.target.value)}
          disabled={isDisabled}
          className="appearance-none w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-xl py-2 px-3 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-label="Select social media platform"
        >
          {platforms.map((platform) => (
            <option key={platform} value={platform} className="bg-white dark:bg-gray-800 text-black dark:text-white">
              {platform}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </div>
      </div>
    </div>
  );
};

export default SocialPlatformSelector;