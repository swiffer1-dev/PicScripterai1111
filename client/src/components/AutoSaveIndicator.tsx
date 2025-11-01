import React from 'react';

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const AutoSaveIndicator: React.FC = () => {
  return (
    <div className="flex items-center px-2 py-0.5 bg-gray-600/50 text-gray-400 rounded-full text-xs">
        <ClockIcon />
        <span>Auto-saved to session</span>
    </div>
  );
};

export default AutoSaveIndicator;
