export const API_BASE = "https://8905008d-18f7-4e7e-9254-0c4a70acf1e8-00-pgjqspkf60qj.kirk.replit.dev";

import { Category, PromptTemplateParams } from '../types/ai-studio';

const generateToneInstruction = (tone: string): string => {
  switch (tone) {
    case 'Professional': return "The tone should be formal, polished, and authoritative.";
    case 'Casual': return "The tone should be relaxed, friendly, and conversational.";
    case 'Luxury': return "The tone should be elegant, sophisticated, and aspirational.";
    case 'Playful': return "The tone should be fun, witty, and energetic.";
    case 'Motivational': return "The tone should be inspiring, uplifting, and encouraging.";
    default: return "The tone should be engaging.";
  }
};

const generatePlatformSpecificInstructions = (platform: string | undefined, addHashtags: boolean, addEmojis: boolean): string => {
  let instructions = '';
  switch (platform) {
    case 'Instagram':
      instructions = "End with an engaging question.";
      if (addHashtags) instructions += " Suggest 3-5 relevant hashtags.";
      if (addEmojis) instructions += " Emojis are encouraged.";
      break;
    case 'Facebook':
      instructions = "Write a slightly longer, more narrative post. End with a question to engage followers.";
      if (addHashtags) instructions += " Hashtags can be used sparingly at the end.";
      break;
    case 'X (Twitter)':
      instructions = "Keep the post extremely concise and punchy, under 280 characters. A strong statement or question is effective.";
      if (addHashtags) instructions += " Use 1-2 relevant hashtags.";
      break;
    case 'TikTok':
      instructions = "Craft a very short, catchy caption suitable for a TikTok video. The tone should be fun, informal, and trendy. Encourage viewer engagement.";
      if (addHashtags) instructions += " Include 3-5 popular and relevant hashtags to maximize visibility.";
      break;
    case 'Pinterest':
      instructions = "Write a descriptive, keyword-rich 'pin' description. Focus on what the image shows and what it inspires, making it highly searchable.";
      break;
    case 'LinkedIn':
      instructions = "Adopt a professional and polished tone. Focus on unique selling propositions, business aspects, or brand storytelling.";
      if (addEmojis) instructions = instructions.replace("Adopt a professional and polished tone.", "Adopt a professional and polished tone. Use emojis very sparingly, if at all.");
      break;
    default:
      if (addHashtags) instructions += " Suggest a few relevant hashtags.";
      break;
  }
  return instructions;
};

const buildFinalPrompt = (basePrompt: string, { tone, addHashtags, addEmojis, customPrompt, language, socialPlatform }: PromptTemplateParams): string => {
  let prompt = basePrompt;
  prompt += `\n\nStyle Guidelines:`;
  prompt += `\n- ${generateToneInstruction(tone)}`;
  prompt += `\n- ${generatePlatformSpecificInstructions(socialPlatform, addHashtags, addEmojis)}`;
  
  if (customPrompt) {
    prompt += `\n\nAdditional Instructions from user: ${customPrompt}`;
  }
  
  prompt += "\n\nThe final output must be plain text, without any special formatting like asterisks or markdown. It should be ready to be copied directly to a social media post.";
  prompt += `\n\nImportant: The entire response must be in ${language}.`;
  
  return prompt;
};


export const CATEGORY_PROMPTS: Record<Category, (params: PromptTemplateParams) => string> = {
  [Category.Travel]: (params) => {
    let base = `Generate a social media post for ${params.socialPlatform} about the travel destination shown in the image(s). Write it in a review style, highlighting the best features and unique experiences.`;
    return buildFinalPrompt(base, params);
  },
  [Category.RealEstate]: (params) => {
    let base = `Generate a detailed and compelling real estate listing description for the property shown in the image(s), tailored for the social media platform: ${params.socialPlatform}. Synthesize information from all provided images to give a complete picture of the property, focusing on architectural style, interior features, outdoor spaces, and any recent upgrades.`;
    if (params.address) {
      base += `\n\nUse the following address to automatically incorporate location-specific details: ${params.address}. Mention nearby amenities like schools, stores, parks, and public transport options.`;
    }
    base += "\n\nIncorporate relevant SEO keywords naturally. End with a strong call to action.";
    return buildFinalPrompt(base, params);
  },
  [Category.Ecommerce]: (params) => {
    let base = `Write a persuasive e-commerce product description for the item in the image(s), tailored for ${params.socialPlatform}. If multiple images are provided, use them to highlight different features. Emphasize customer benefits and explain how it solves a problem or enhances their life.`;
    base += "\n\nCrucially, analyze the image for specific identifying details. If there are visible brands or logos, identify them and incorporate them into the description. If the item is a car or another vehicle, identify its make, model, and estimate the model year if possible.";
    return buildFinalPrompt(base, params);
  },
  [Category.Food]: (params) => {
    let base = `Generate a short and snappy food review for the dish in the image(s), perfect for ${params.socialPlatform}. Focus on the key flavors, presentation, and overall experience in a concise and enthusiastic manner. The style should be mouth-watering and feel like a personal recommendation.`;
    return buildFinalPrompt(base, params);
  },
  [Category.Fashion]: (params) => {
    let base = `Generate a chic and stylish social media post for ${params.socialPlatform} about the fashion look in the image(s). Describe the outfit, focusing on key pieces, fabrics, and the overall aesthetic (e.g., minimalist, bohemian, streetwear). Mention any visible brands.`;
    return buildFinalPrompt(base, params);
  },
  [Category.Custom]: (params) => {
    let base = `Generate a social media post for ${params.socialPlatform} based on the image(s). The user's instructions are paramount. If their instructions are minimal, analyze the image and create a suitable, high-quality description.`;
    // For Custom, the user prompt is the main driver.
    return buildFinalPrompt(base, params);
  },
};