import { GoogleGenAI, Type } from "@google/genai";

interface DiffEntry {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

const AI_BUZZWORDS: Record<string, string> = {
  'delve': 'explore',
  'delve into': 'explore',
  'delving': 'exploring',
  'utilize': 'use',
  'utilizing': 'using',
  'leverage': 'use',
  'leveraging': 'using',
  'in today\'s digital landscape': 'today',
  'cutting-edge': 'modern',
  'game-changer': 'transformative',
  'game changing': 'transformative',
  'revolutionary': 'innovative',
  'unlock the power': 'discover',
  'unlock': 'access',
  'seamless': 'smooth',
  'robust': 'strong',
  'elevate your': 'improve your',
  'elevate': 'improve',
  'dive deep': 'explore',
  'dive into': 'explore',
  'empower': 'enable',
  'empowering': 'enabling',
  'synergy': 'collaboration',
  'paradigm shift': 'major change',
  'innovative solution': 'new approach',
  'take it to the next level': 'improve it',
  'at the end of the day': 'ultimately',
  'think outside the box': 'be creative',
  'low-hanging fruit': 'easy wins',
  'circle back': 'return to',
  'touch base': 'connect',
  'groundbreaking': 'innovative',
  'transformative': 'changing',
  'disruptive': 'innovative'
};

const removeBuzzwords = (text: string): { cleanedText: string; replacements: string[] } => {
  let cleanedText = text;
  const replacements: string[] = [];
  
  const sortedBuzzwords = Object.entries(AI_BUZZWORDS).sort((a, b) => b[0].length - a[0].length);
  
  for (const [buzzword, replacement] of sortedBuzzwords) {
    const regex = new RegExp(`\\b${buzzword}\\b`, 'gi');
    const matches = cleanedText.match(regex);
    
    if (matches) {
      cleanedText = cleanedText.replace(regex, (match) => {
        if (match[0] === match[0].toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
      replacements.push(buzzword);
    }
  }
  
  return { cleanedText, replacements };
};

export interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export const generateDescription = async (
  imageParts: ImagePart[],
  prompt: string
): Promise<{ description: string; metadata: string; buzzwordsRemoved?: string[] }> => {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const instruction = `
    You have two tasks:
    
    1. Create a brief, one-sentence factual summary of the image contents (e.g., "A photo of a golden retriever playing on a sunny beach.")
    
    2. Follow the user's primary instruction below to generate the main content.
    
    User's instruction:
    ${prompt}
    
    Format your response EXACTLY like this:
    IMAGE_SUMMARY: [your one-sentence summary here]
    
    GENERATED_CONTENT:
    [your main generated content here]
  `;

  try {
    const textPart = { text: instruction };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [...imageParts, textPart] }],
    });
    
    const responseText = response.text || '';
    
    const summaryMatch = responseText.match(/IMAGE_SUMMARY:\s*(.+?)(?=\n\nGENERATED_CONTENT:)/);
    const contentMatch = responseText.match(/GENERATED_CONTENT:\s*([\s\S]+)/);
    
    const imageSummary = summaryMatch ? summaryMatch[1].trim() : 'Image description';
    const generatedContent = contentMatch ? contentMatch[1].trim() : responseText;
    
    const { cleanedText, replacements } = removeBuzzwords(generatedContent);
    
    return {
      description: cleanedText,
      metadata: imageSummary,
      buzzwordsRemoved: replacements.length > 0 ? replacements : undefined,
    };

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
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  
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
