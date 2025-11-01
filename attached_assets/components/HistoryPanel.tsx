import React, { useState, useMemo } from 'react';
import { Category, HistoryItem } from '../types';

// Icons
const DraftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500/80" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const DeleteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface HistoryPanelProps {
  history: HistoryItem[];
  drafts: HistoryItem[];
  selectedHistoryId: number | null;
  onSelectItem: (id: number) => void;
  onDeleteItem: (id: number) => void;
  onDeleteDraftItem: (id: number) => void;
  onClearHistory: () => void;
  onClearDrafts: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ drafts, selectedHistoryId, onSelectItem, onDeleteDraftItem, onClearDrafts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const sortedDrafts = useMemo(() => [...drafts].sort((a, b) => b.id - a.id), [drafts]);

  const filteredDrafts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return sortedDrafts;
    return sortedDrafts.filter(item => 
        item.content?.toLowerCase().includes(term) || 
        item.metadata?.toLowerCase().includes(term)
    );
  }, [sortedDrafts, searchTerm]);

  const handleDeleteDraft = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onDeleteDraftItem(id);
  };
  
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-gray-200 dark:border-white/10 flex flex-col h-full">
      <div className="flex-shrink-0 mb-3">
          <div className="relative">
              <input 
                  type="text"
                  placeholder="Search drafts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-800 dark:text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon />
              </div>
          </div>
      </div>

      <div className="flex flex-col flex-grow min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center mb-3 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Drafts</h2>
            {drafts.length > 0 && (
              <button onClick={onClearDrafts} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:underline">Clear All</button>
            )}
          </div>
          <div className="overflow-y-auto pr-2 -mr-2">
            {drafts.length === 0 ? <p className="text-center text-gray-500 text-sm py-4">Your saved drafts will appear here.</p> :
             filteredDrafts.length === 0 ? <p className="text-center text-gray-500 text-sm py-4">No drafts match your search.</p> :
             <ul className="space-y-2">{filteredDrafts.map((item) => (
                <li key={item.id}>
                    <button
                        onClick={() => onSelectItem(item.id)}
                        className={`w-full text-left p-2.5 rounded-lg border-2 transform transition-all duration-300 ease-in-out group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-indigo-500 flex items-center space-x-3 relative sidebar-glow
                        ${selectedHistoryId === item.id ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/80' : 'bg-gray-100 dark:bg-black/20 border-transparent hover:border-gray-300 dark:hover:border-white/20'}
                        `}
                    >
                        {item.previewUrls && item.previewUrls.length > 0 ? (
                        <div className="w-12 h-12 flex-shrink-0 bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden">
                            <img src={item.previewUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        ) : (
                        <div className="w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-black/30 rounded-md flex items-center justify-center">
                            <DraftIcon />
                        </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-1">
                                {item.metadata || item.content?.split('\n')[0] || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(item.id).toLocaleDateString()}</p>
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button
                                onClick={(e) => handleDeleteDraft(e, item.id)}
                                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400"
                                aria-label="Delete draft"
                                >
                                <DeleteIcon />
                            </button>
                        </div>
                    </button>
                </li>
             ))}</ul>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;