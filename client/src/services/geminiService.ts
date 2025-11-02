import { GoogleGenAI, Type } from "@google/genai";
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
        }, file.type, 0.65); // 65% quality for even smaller file size
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
): Promise<{ description: string; metadata: string }> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  console.log("API Key check:", apiKey ? `SET (${apiKey.length} chars)` : 'NOT SET');
  
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is not set.");
  }

  console.log("Initializing GoogleGenAI client...");
  const ai = new GoogleGenAI({ apiKey });
  console.log("Client initialized successfully");
  
  const instruction = `
    You have two tasks. First, create a brief, one-sentence factual summary of the image contents (e.g., "A photo of a golden retriever playing on a sunny beach."). This will be the 'imageSummary'.
    Second, follow the user's primary instruction to generate the main content. This will be the 'generatedContent'.
    The user's primary instruction is: "${prompt}"

    Return your response as a single, minified JSON object with two keys: "imageSummary" and "generatedContent". Do not include any other text, formatting, or markdown.
  `;

  try {
    // Validate images
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'];
    const maxSize = 20 * 1024 * 1024; // 20MB
    
    for (const file of imageFiles) {
      console.log(`Validating image: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      if (!supportedTypes.includes(file.type)) {
        throw new Error(`Unsupported image format: ${file.type}. Supported formats: JPEG, PNG, WebP, HEIC, HEIF, AVIF`);
      }
      
      if (file.size > maxSize) {
        throw new Error(`Image ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 20MB.`);
      }
    }
    
    // Resize large images before converting to base64
    const resizedFiles = await Promise.all(
      imageFiles.map(async (file) => {
        // Always resize to ensure reasonable file sizes for API
        console.log(`Processing ${file.name} (${(file.size / 1024).toFixed(0)}KB)...`);
        const resized = await resizeImage(file, 1024, 1024); // Even smaller: 1024x1024
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
    
    const textPart = {
      text: instruction,
    };

    console.log("Calling Gemini API");
    console.log("Image parts:", imageParts.length);
    
    // Call Gemini API - try gemini-2.0-flash-exp which is available in v1beta
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [...imageParts, textPart] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imageSummary: { type: Type.STRING },
            generatedContent: { type: Type.STRING },
          },
          required: ['imageSummary', 'generatedContent'],
        },
      },
    });
    
    console.log("Gemini API response received");
    
    const responseText = response.text || '{}';
    const resultJson = JSON.parse(responseText);
    
    return {
      description: resultJson.generatedContent,
      metadata: resultJson.imageSummary,
    };

  } catch (error) {
    console.error("Error generating description:", error);
    const errorMessage = error instanceof Error 
      ? error.message
      : "An unknown error occurred while generating the description.";
    
    throw new Error(`Failed to generate description: ${errorMessage}`);
  }
};

export const proofreadText = async (text: string): Promise<{ correctedText: string; hasCorrections: boolean; changesSummary: string; diff: DiffEntry[] | null; }> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a proofreading assistant. Analyze the following text for grammar, spelling, and punctuation errors. Return your response as a single, minified JSON object with four keys:
1. "correctedText": The full text with all corrections applied. If no errors are found, this should be the original text.
2. "hasCorrections": A boolean value. 'true' if any corrections were made, 'false' otherwise.
3. "changesSummary": A brief, user-friendly string summarizing the changes made (e.g., "Fixed 3 spelling mistakes and 2 punctuation errors."). If no changes were made, this string should say "No corrections needed."
4. "diff": An array of objects representing the changes on a word-by-word basis. Each object must have two keys: "type" (string values can be 'added', 'removed', or 'unchanged') and "value" (the corresponding text segment, including spaces and punctuation). If no changes are made, the diff array should contain a single object of type 'unchanged' with the original text as its value.

Do not include any other text, formatting, or markdown.

Text to proofread:
"${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedText: { type: Type.STRING },
            hasCorrections: { type: Type.BOOLEAN },
            changesSummary: { type: Type.STRING },
            diff: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
                required: ['type', 'value'],
              }
            }
          },
          required: ['correctedText', 'hasCorrections', 'changesSummary', 'diff'],
        }
      }
    });
    // FIX: The response text from the Gemini API might be wrapped in markdown backticks.
    // Clean the string before parsing to ensure it's valid JSON.
    const responseText2 = response.text || '{}';
    const cleanJsonText2 = responseText2.replace(/^```json\n/, '').replace(/\n```$/, '');
    const resultJson = JSON.parse(cleanJsonText2);
    return resultJson;
  } catch (error) {
    console.error("Error proofreading text:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred while proofreading the text.";
    
    throw new Error(`Failed to proofread text: ${errorMessage}`);
  }
};
