import React from 'react';
import { Category } from '../types';

interface CategorySelectorProps {
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
  isDisabled: boolean;
}

const TravelIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const RealEstateIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>);
const EcommerceIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.328 1.095-.821l1.923-6.861c.125-.445-.317-.928-.8-1.01l-11.218-2.12a1.5 1.5 0 00-1.848 1.848l.896 4.482M7.5 14.25L5.106 5.106M15.75 14.25l2.25-2.25" /></svg>);
const FoodIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 12a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.75 9.75 0 100-19.5 9.75 9.75 0 000 19.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75l-4.5 4.5m0-4.5l4.5 4.5m4.5-4.5l-4.5 4.5m0-4.5l4.5 4.5" /></svg>);
const FashionIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.548 3.454l.432 1.936a.37.37 0 00.33.284l1.936.432a.37.37 0 01.284.33l.432 1.936a.37.37 0 00.284.33l1.936.432a.37.37 0 01.33.284l.432 1.936a.37.37 0 00.33.284l1.936.432a.37.37 0 01.284.33l.432 1.936a.37.37 0 00.284.33l1.936.432a.37.37 0 01.33.284l.432 1.936" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h18M3 21h18" /></svg>);
const CustomIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.025 1.11-1.11a13.438 13.438 0 015.1 1.266c.39.183.693.535.816.968a13.438 13.438 0 01-1.266 5.1c-.085.55-.568 1.02-1.11 1.11a13.438 13.438 0 01-5.1-1.266c-.39-.183-.693-.535-.816-.968a13.438 13.438 0 011.266-5.1z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 18.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm12.75 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 12.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 6a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>);

const categoryOptions = [
  { id: Category.Travel, label: 'Travel', icon: <TravelIcon /> },
  { id: Category.RealEstate, label: 'Real Estate', icon: <RealEstateIcon /> },
  { id: Category.Ecommerce, label: 'E-commerce', icon: <EcommerceIcon /> },
  { id: Category.Food, label: 'Food', icon: <FoodIcon /> },
  { id: Category.Fashion, label: 'Fashion', icon: <FashionIcon /> },
  { id: Category.Custom, label: 'Custom', icon: <CustomIcon /> },
];

const CategorySelector: React.FC<CategorySelectorProps> = ({ selectedCategory, onCategoryChange, isDisabled }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {categoryOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => onCategoryChange(option.id)}
          disabled={isDisabled}
          className={`group flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-indigo-500 transform hover:-translate-y-1
            ${selectedCategory === option.id 
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
              : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/30 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
            }
            ${isDisabled ? 'opacity-50 cursor-not-allowed transform-none' : ''}
          `}
        >
          <div className={`transition-colors ${selectedCategory !== option.id && 'text-gray-500 dark:text-current group-hover:text-indigo-400'}`}>
            {option.icon}
          </div>
          <span className="mt-2 text-xs sm:text-sm font-semibold">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default CategorySelector;