import { apiRequest } from "@/lib/queryClient";
import { DiffEntry } from "../types/ai-studio";

const resizeImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert back to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Could not create blob from canvas'));
          }
          const resizedFile = new File([blob], file.name, { type: file.type });
          console.log(`Resized ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(resizedFile.size / 1024).toFixed(0)}KB`);
          resolve(resizedFile);
        }, file.type, 0.65); // 65% quality for smaller file size
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('FileReader did not return a string.'));
      }
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateDescription = async (
  imageFiles: File[],
  prompt: string
): Promise<{ description: string; metadata: string; buzzwordsRemoved?: string[] }> => {
  
  try {
    // Validate images
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const maxSize = 20 * 1024 * 1024; // 20MB
    
    for (const file of imageFiles) {
      console.log(`Validating image: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      if (!supportedTypes.includes(file.type)) {
        throw new Error(`Unsupported image format: ${file.type}. Supported formats: JPEG, PNG, WebP, HEIC, HEIF (AVIF not supported)`);
      }
      
      if (file.size > maxSize) {
        throw new Error(`Image ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 20MB.`);
      }
    }
    
    // Resize large images before converting to base64
    const resizedFiles = await Promise.all(
      imageFiles.map(async (file) => {
        console.log(`Processing ${file.name} (${(file.size / 1024).toFixed(0)}KB)...`);
        const resized = await resizeImage(file, 1024, 1024);
        console.log(`Result: ${(resized.size / 1024).toFixed(0)}KB`);
        return resized;
      })
    );
    
    const imageParts = await Promise.all(
      resizedFiles.map(async (file) => {
        console.log(`Converting ${file.name} to base64...`);
        const base64Data = await fileToBase64(file);
        console.log(`${file.name} converted successfully (${base64Data.length} bytes)`);
        return {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        };
      })
    );
    
    console.log("Calling backend AI API");
    console.log("Image parts:", imageParts.length);
    
    // Call secure backend API endpoint
    const response = await apiRequest("POST", "/api/ai/generate", {
      imageParts,
      prompt,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate description");
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error("Error generating description:", error);
    const errorMessage = error instanceof Error 
      ? error.message
      : "An unknown error occurred while generating the description.";
    
    throw new Error(`Failed to generate description: ${errorMessage}`);
  }
};

export const proofreadText = async (text: string): Promise<{ 
  correctedText: string; 
  hasCorrections: boolean; 
  changesSummary: string; 
  diff: DiffEntry[] | null; 
}> => {
  try {
    // Call secure backend API endpoint
    const response = await apiRequest("POST", "/api/ai/proofread", {
      text,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to proofread text");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error proofreading text:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred while proofreading the text.";
    
    throw new Error(`Failed to proofread text: ${errorMessage}`);
  }
};
