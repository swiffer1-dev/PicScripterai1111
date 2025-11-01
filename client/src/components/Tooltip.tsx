import React, { useState, useRef } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactElement;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
    }, 150); // Small delay to prevent flickering
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {/* FIX: Cast props to 'any' to resolve TypeScript error where 'aria-describedby' is not recognized on a generic child element. */}
      {React.cloneElement(children, { 'aria-describedby': `tooltip-${text}` } as any)}
      <div
        id={`tooltip-${text}`}
        role="tooltip"
        className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs font-semibold rounded-md py-1.5 px-3 shadow-lg z-20 pointer-events-none transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!isVisible}
      >
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default Tooltip;