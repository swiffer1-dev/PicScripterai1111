import React, { useState } from 'react';
import { Preset } from '../types';

interface SavePresetButtonProps {
  presets: Preset[];
  onSave: (name: string) => void;
  isDisabled: boolean;
}

const SavePresetButton: React.FC<SavePresetButtonProps> = ({ presets, onSave, isDisabled }) => {
  const [isNaming, setIsNaming] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const handleStartSave = () => {
    setIsNaming(true);
    setNameError(null);
  };

  const handleCancelSave = () => {
    setIsNaming(false);
    setNewPresetName('');
    setNameError(null);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newPresetName.trim();
    if (!trimmedName) {
      setNameError("Preset name cannot be empty.");
      return;
    }
    if (presets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setNameError("A preset with this name already exists.");
      return;
    }
    onSave(trimmedName);
    handleCancelSave();
  };

  if (isNaming) {
    return (
      <form onSubmit={handleConfirmSave} className="space-y-3 mt-6 pt-6 border-t border-gray-200 dark:border-white/10 animate-in fade-in-0 duration-300">
        <label htmlFor="preset-name-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">Save Current Configuration as Preset</label>
        <div>
          <input
            id="preset-name-input"
            type="text"
            value={newPresetName}
            onChange={(e) => { setNewPresetName(e.target.value); if (nameError) setNameError(null); }}
            placeholder="Enter preset name..."
            className={`w-full bg-gray-100 dark:bg-white/5 border ${nameError ? 'border-red-500' : 'border-gray-300 dark:border-white/20'} rounded-xl py-2 px-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition`}
            aria-label="New preset name"
            autoFocus
          />
          {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 rounded-lg transition-colors">Save</button>
          <button type="button" onClick={handleCancelSave} className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-gray-200 text-sm font-semibold hover:bg-gray-300 dark:hover:bg-white/20 rounded-lg transition-colors">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
      <button
        onClick={handleStartSave}
        disabled={isDisabled}
        className="w-full flex items-center justify-center py-2 px-3 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
        Save Configuration as Preset
      </button>
    </div>
  );
};

export default SavePresetButton;