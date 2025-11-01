import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  previewUrls: string[];
  isLoading: boolean;
  onClearImages: () => void;
  onDeleteImage: (index: number) => void;
  onReorderImages: (dragIndex: number, hoverIndex: number) => void;
}

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25z" />
    </svg>
);

const ClearIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const SmallClearIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);


const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageChange, previewUrls, isLoading, onClearImages, onDeleteImage, onReorderImages }) => {
  const numImages = previewUrls.length;
  let gridConfig = 'grid-cols-2 gap-2'; // Default for 2-4 images

  if (numImages === 1) {
    gridConfig = 'grid-cols-1 gap-0';
  } else if (numImages > 4 && numImages <= 9) {
    gridConfig = 'grid-cols-3 gap-1.5';
  } else if (numImages > 9) {
    gridConfig = 'grid-cols-4 gap-1';
  }

  const dragItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if ((e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        return;
    }
    dragItem.current = index;
    setTimeout(() => {
        (e.target as HTMLDivElement).classList.add('opacity-40', 'dragging-item');
    }, 0);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
    if (dragItem.current !== null && dragItem.current !== index) {
      onReorderImages(dragItem.current, index);
      dragItem.current = index;
    }
  };
  
  const handleDragLeaveReorder = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    setDragOverIndex(null);
    const draggedElement = document.querySelector('.dragging-item');
    if (draggedElement) {
        draggedElement.classList.remove('opacity-40', 'dragging-item');
    }
  };

  const handleDragOverReorder = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };
  
  // Handlers for the main drop zone
  const handleDragEnterZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragActive(true);
    }
  };

  const handleDragLeaveZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOverZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const syntheticEvent = {
            target: {
                files: e.dataTransfer.files
            }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onImageChange(syntheticEvent);
        e.dataTransfer.clearData();
    }
  };

  return (
    <div 
        className={`w-full h-full bg-gray-100 dark:bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-white/20 relative overflow-hidden transition-all duration-300 ease-in-out aspect-square group glow-effect ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-400' : ''}`}
        onDragEnter={handleDragEnterZone}
        onDragLeave={handleDragLeaveZone}
        onDragOver={handleDragOverZone}
        onDrop={handleDrop}
    >
      {previewUrls.length > 0 && !isLoading && (
        <button
          onClick={onClearImages}
          className="absolute top-2 right-2 z-10 bg-black/50 text-white rounded-full p-1.5 hover:bg-red-600/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
          aria-label="Clear all images"
        >
          <ClearIcon />
        </button>
      )}
      <label htmlFor="image-upload" className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-center">
        {previewUrls.length > 0 ? (
          <div className={`grid ${gridConfig} w-full h-full overflow-y-auto p-1`}>
             {previewUrls.map((url, index) => (
                <div 
                    key={`${url}-${index}`}
                    className={`relative aspect-square group/item cursor-grab active:cursor-grabbing transition-all duration-200 ${dragOverIndex === index ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 ring-offset-gray-100 dark:ring-offset-black/20 rounded-lg' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOverReorder}
                    onDragLeave={handleDragLeaveReorder}
                >
                    <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg pointer-events-none" />
                     <button
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteImage(index); }}
                        className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full p-1 hover:bg-red-600/80 transition-colors opacity-0 group-hover/item:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                        aria-label={`Remove image ${index + 1}`}
                    >
                        <SmallClearIcon />
                    </button>
                </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center pointer-events-none">
            <UploadIcon />
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-500">You can select multiple files</p>
          </div>
        )}
        <input id="image-upload" type="file" accept="image/*" multiple className="hidden" onChange={onImageChange} disabled={isLoading} />
      </label>
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col text-white">
          <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 font-semibold">Analyzing Images...</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;