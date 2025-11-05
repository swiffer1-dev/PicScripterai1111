export const API_BASE = "https://8905008d-18f7-4e7e-9254-0c4a70acf1e8-00-pgjqspkf60qj.kirk.replit.dev";

import { Category, PromptTemplateParams } from '../types/ai-studio';

const AI_BUZZWORDS = [
  'delve', 'utilize', 'leverage', 'in today\'s digital landscape', 'cutting-edge', 
  'game-changer', 'revolutionary', 'unlock the power', 'seamless', 'robust',
  'elevate your', 'dive deep', 'empower', 'synergy', 'paradigm shift',
  'innovative solution', 'take it to the next level', 'at the end of the day',
  'think outside the box', 'low-hanging fruit', 'circle back', 'touch base',
  'game changing', 'groundbreaking', 'transformative', 'disruptive'
];

const generateToneInstruction = (tone: string): string => {
  const humanAuthenticityRules = `

**Human Authenticity Engine:**
- Mix sentence lengths naturally: some short and punchy (5-10 words), others longer and descriptive (20-30 words)
- Include light personality cues like "You'll love how this fits", "Trust me on this", "Here's the thing"
- Write like a real person, not a corporate bot
- STRICTLY AVOID these AI buzzwords: ${AI_BUZZWORDS.join(', ')}
- Use natural transitions and conversational bridges
- Vary your sentence structure to create rhythm
`;

  switch (tone) {
    case 'Authentic':
      return `The tone should feel genuinely human - like a friend sharing a real experience. Be honest, relatable, and down-to-earth. ${humanAuthenticityRules}
- Add personal touches ("I noticed...", "What struck me was...")
- Use specific details over generic descriptions
- Keep it real - no hype or exaggeration`;
      
    case 'Conversational':
      return `Write like you're chatting with a friend over coffee. Be warm, engaging, and approachable. ${humanAuthenticityRules}
- Use contractions (you'll, it's, we're)
- Ask questions to engage readers
- Include casual transitions ("So here's the deal...", "Okay, real talk...")
- Feel free to use fragments for emphasis. Like this.`;
      
    case 'SEO Boosted':
      return `Optimize for search and discovery while maintaining natural readability. ${humanAuthenticityRules}
- Incorporate relevant keywords naturally (no keyword stuffing)
- Use descriptive, searchable language
- Include specific details that people search for
- Balance SEO optimization with human readability - never sacrifice authenticity for keywords`;
      
    case 'Professional': 
      return `The tone should be formal, polished, and authoritative. ${humanAuthenticityRules}`;
      
    case 'Casual': 
      return `The tone should be relaxed, friendly, and conversational. ${humanAuthenticityRules}`;
      
    case 'Luxury': 
      return `The tone should be elegant, sophisticated, and aspirational. ${humanAuthenticityRules}`;
      
    case 'Playful': 
      return `The tone should be fun, witty, and energetic. ${humanAuthenticityRules}`;
      
    case 'Motivational': 
      return `The tone should be inspiring, uplifting, and encouraging. ${humanAuthenticityRules}`;
      
    default: 
      return `The tone should be engaging. ${humanAuthenticityRules}`;
  }
};

const generatePlatformSpecificInstructions = (platform: string | undefined, addHashtags: boolean, addEmojis: boolean): string => {
  let instructions = '';
  switch (platform) {
    case 'Instagram':
      instructions = "CRITICAL: Keep total length under 2200 characters. End with an engaging question.";
      if (addHashtags) instructions += " Suggest 3-5 relevant hashtags.";
      if (addEmojis) instructions += " Use emojis naturally throughout to add personality and visual appeal.";
      break;
    case 'Facebook':
      instructions = "Write a slightly longer, more narrative post. End with a question to engage followers.";
      if (addHashtags) instructions += " Hashtags can be used sparingly at the end.";
      if (addEmojis) instructions += " Add 2-3 emojis to make the post more engaging.";
      break;
    case 'X (Twitter)':
      instructions = "CRITICAL: MAXIMUM 280 characters total (including hashtags and emojis). Keep the post extremely concise and punchy. A strong statement or question is effective.";
      if (addHashtags) instructions += " Use 1-2 short hashtags.";
      if (addEmojis) instructions += " Include 1-2 emojis to enhance the message.";
      break;
    case 'TikTok':
      instructions = "CRITICAL: Keep total length under 2200 characters. Craft a very short, catchy caption suitable for a TikTok video. The tone should be fun, informal, and trendy. Encourage viewer engagement.";
      if (addHashtags) instructions += " Include 3-5 popular and relevant hashtags to maximize visibility.";
      if (addEmojis) instructions += " Use fun emojis to match the energetic TikTok vibe.";
      break;
    case 'Pinterest':
      instructions = "CRITICAL: MAXIMUM 500 characters total (including all text). Write a concise, keyword-rich 'pin' description. Focus on what the image shows and what it inspires, making it highly searchable. Be brief and impactful.";
      if (addEmojis) instructions += " Add 1-2 relevant emojis to make the pin more eye-catching.";
      break;
    case 'LinkedIn':
      instructions = "CRITICAL: Keep total length under 3000 characters. Adopt a professional and polished tone. Focus on unique selling propositions, business aspects, or brand storytelling.";
      if (addEmojis) instructions += " Use emojis very sparingly, if at all - maintain professional tone.";
      break;
    default:
      if (addHashtags) instructions += " Suggest a few relevant hashtags.";
      if (addEmojis) instructions += " Include emojis naturally to enhance engagement.";
      break;
  }
  return instructions;
};

const buildFinalPrompt = (basePrompt: string, { tone, addHashtags, addEmojis, customPrompt, language, socialPlatform }: PromptTemplateParams): string => {
  let prompt = '';
  
  // CRITICAL: Emoji instruction at the very top if enabled
  if (addEmojis) {
    prompt += `🚨 CRITICAL INSTRUCTION: You MUST include emojis in your response. This is NOT optional. Use 3-8 relevant emojis naturally distributed throughout the text. Examples: ✨🌟💫🎯🔥💪❤️🎉🌈☀️🌺🎨📸🏆💎🌍✈️🍕🎵📱💼🏠🌟\n\n`;
  }
  
  prompt += basePrompt;
  prompt += `\n\nStyle Guidelines:`;
  prompt += `\n- ${generateToneInstruction(tone)}`;
  prompt += `\n- ${generatePlatformSpecificInstructions(socialPlatform, addHashtags, addEmojis)}`;
  
  if (customPrompt) {
    prompt += `\n\nAdditional Instructions from user: ${customPrompt}`;
  }
  
  prompt += "\n\nThe final output must be plain text, without any special formatting like asterisks or markdown. It should be ready to be copied directly to a social media post.";
  prompt += `\n\nImportant: The entire response must be in ${language}.`;
  
  // Reminder at the end if emojis enabled
  if (addEmojis) {
    prompt += `\n\n⚠️ REMINDER: DO NOT FORGET TO INCLUDE EMOJIS IN YOUR RESPONSE. Use at least 3-8 emojis.`;
  }
  
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