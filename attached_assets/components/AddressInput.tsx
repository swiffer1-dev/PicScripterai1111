
import React from 'react';

interface AddressInputProps {
  address: string;
  onAddressChange: (address: string) => void;
  isDisabled: boolean;
}

const LocationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const AddressInput: React.FC<AddressInputProps> = ({ address, onAddressChange, isDisabled }) => {
  return (
    <div>
      <label htmlFor="address-input" className="block font-bold text-lg text-gray-800 dark:text-gray-200 mb-4">
        Property Address (Optional)
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LocationIcon />
        </div>
        <input
          id="address-input"
          type="text"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="e.g., 123 Main St, Anytown, USA"
          className="w-full p-3 pl-10 bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-800 dark:text-gray-300 placeholder-gray-500"
          disabled={isDisabled}
          aria-label="Property Address Input"
        />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Providing an address helps the AI include local details like schools and stores.
      </p>
    </div>
  );
};

export default AddressInput;
