export enum Category {
  Travel = 'Travel',
  RealEstate = 'Real Estate',
  Ecommerce = 'E-commerce',
  Food = 'Food',
  Fashion = 'Fashion',
  Custom = 'Custom',
}

export type Tone = 'Professional' | 'Casual' | 'Luxury' | 'Playful' | 'Motivational';

export interface HistoryItem {
  id: number;
  content: string;
  metadata: string;
  category: Category;
  previewUrls: string[];
  imageFiles: File[];
  customPrompt: string;
  address: string;
  language: string;
  socialPlatform: string;
  tone: Tone;
  addHashtags: boolean;
  addEmojis: boolean;
  isDraft?: boolean;
}

export interface PromptTemplateParams {
  address?: string;
  customPrompt?: string;
  language: string;
  socialPlatform?: string;
  tone: Tone;
  addHashtags: boolean;
  addEmojis: boolean;
}

export interface DiffEntry {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export interface BatchResultItem {
  id: string;
  content: string;
  metadata: string;
  previewUrl: string;
  imageFile: File;
  isProofreading?: boolean;
  proofreadMessage?: { text: string; type: 'success' | 'info' | 'error' } | null;
  proofreadDiff?: DiffEntry[] | null;
  hasCorrections?: boolean;
}

export interface Preset {
  name: string;
  category: Category;
  language: string;
  socialPlatform: string;
  customPrompt: string;
  tone: Tone;
  addHashtags: boolean;
  addEmojis: boolean;
}

export type PlatformKey =
  | "instagram"
  | "facebook"
  | "pinterest"
  | "twitter"
  | "tiktok"
  | "linkedin"
  | "youtube";

export interface PlatformInfo {
  key: PlatformKey;
  name: string;
  connected: boolean;
  selectable: boolean;
  testEndpoint?: string;
}
