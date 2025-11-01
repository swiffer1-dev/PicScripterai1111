import React, { useState } from 'react';
import { Preset } from '../types';
import Tooltip from './Tooltip';

interface PresetManagerProps {
  presets: Preset[];
  selectedPresetName: string;
  onApply: (name: string) => void;
  onDelete: (name: string) => void;
  isDisabled: boolean;
}

const ApplyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
);

const DeleteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);


const PresetManager: React.FC<PresetManagerProps> = ({ presets, selectedPresetName, onApply, onDelete, isDisabled }) => {
    const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

    const handleDeleteClick = (name: string) => {
        setPresetToDelete(name);
    };

    const confirmDelete = () => {
        if (presetToDelete) {
            onDelete(presetToDelete);
            setPresetToDelete(null);
        }
    };

    const cancelDelete = () => {
        setPresetToDelete(null);
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Your Presets</h3>
            {presets.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No presets saved yet.</p>
            ) : (
                <ul className="space-y-2 max-h-[15rem] overflow-y-auto pr-2 -mr-2">
                    {presets.map((preset) => (
                        <li 
                            key={preset.name} 
                            className={`flex items-center justify-between p-2 rounded-md transition-colors duration-200 ${selectedPresetName === preset.name ? 'bg-indigo-600/10 dark:bg-indigo-600/20' : 'bg-gray-200 dark:bg-gray-700/50'}`}
                        >
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-2">{preset.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Tooltip text="Apply Preset">
                                    <button
                                        onClick={() => onApply(preset.name)}
                                        disabled={isDisabled}
                                        className="p-1.5 bg-gray-300 dark:bg-gray-600/70 text-gray-700 dark:text-gray-300 hover:bg-indigo-500 dark:hover:bg-indigo-600 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label={`Apply preset ${preset.name}`}
                                    >
                                        <ApplyIcon />
                                    </button>
                                </Tooltip>
                                <Tooltip text="Delete Preset">
                                    <button
                                        onClick={() => handleDeleteClick(preset.name)}
                                        disabled={isDisabled}
                                        className="p-1.5 bg-gray-300 dark:bg-gray-600/70 text-gray-700 dark:text-gray-300 hover:bg-red-500 dark:hover:bg-red-600/80 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label={`Delete preset ${preset.name}`}
                                    >
                                        <DeleteIcon />
                                    </button>
                                </Tooltip>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {presetToDelete && (
                <div 
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in-0"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-dialog-title"
                >
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-300 dark:border-gray-600 shadow-xl w-full max-w-sm">
                        <h4 id="delete-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white">Confirm Deletion</h4>
                        <p className="mt-2 text-gray-700 dark:text-gray-300">
                            Are you sure you want to delete the preset <strong className="font-semibold text-gray-900 dark:text-white">"{presetToDelete}"</strong>? This action cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button 
                                onClick={cancelDelete} 
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-gray-400"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-red-500"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PresetManager;