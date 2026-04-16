// Record type for all content (games, novels, comics, artists)
export type ContentType = 'game' | 'novel' | 'comic' | 'artist';

export interface ContentRecord {
  id: string;
  name: string;
  title: string;
  type: ContentType;
  source: string;
  description: string;
  imageUrl: string;
  coverStoragePath: string;
  link: string;
  tags: string[];
  rating: string;
  releaseDate: string;
  searchKeywords: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface ArtistRecord extends ContentRecord {
  type: 'artist';
  followerCount: number;
  totalWorks: number;
  totalBookmarks: number;
  totalViews: number;
  totalRatings: number;
  bestRank: number;
  sampleWorks: SampleWork[];
  toolsMedium: string[];
  genreSpecialization: string[];
}

export interface SampleWork {
  illustId: string;
  title: string;
  imageUrl: string;
  coverStoragePath: string;
  viewCount: number;
  ratingCount: number;
  tags: string[];
}

export interface ScrapeConfig {
  sourcesEnabled: Record<string, boolean>;
  languageFilter: 'all' | 'en' | 'ja' | 'zh';
  game: CategoryConfig;
  novel: CategoryConfig;
  comic: CategoryConfig;
  artist: ArtistCategoryConfig;
  dlsiteCategories: { label: string; url: string }[];
}

export interface CategoryConfig {
  searchKeywords: string[];
  maxPerKeyword: number;
  maxPerPlatform: number;
  blockKeywords: string[];
}

export interface ArtistCategoryConfig extends CategoryConfig {
  rankingMode: string;
  nsfwFilter: boolean;
}

export interface ScrapeRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: any;
  completedAt?: any;
  totalStages: number;
  currentStageIndex: number;
  currentStageName: string;
  stageProgress: number;
  progressMessage: string;
  logLines: string[];
  savedCount: number;
  error?: string;
}

export type HookType = 'text_overlay' | 'choice' | 'button' | 'swipe' | 'slider';

export interface AdCreative {
  visualDescription: string;
  hookType: HookType;
  hookContent: string;
}

export interface TrendItem {
  rank: number;
  name: string;
  description: string;
  representativeTags: string[];
  exampleTitles: string[];
  score: number;
  adCreatives?: AdCreative[];
}

export interface TrendAnalysis {
  id: string;
  lang: 'zh' | 'en';
  trends: TrendItem[];
  summary: string;
  createdAt: any;
  recordCount: number;
}

// Art style recommendation (LLM-driven, no dependency on scraped data)
export interface ArtStyleRecommendation {
  name: string;
  nameEn: string;
  description: string;
  keywords: string[];
  facialFeatures: string;
  referenceUrls: string[];
  imageUrls: string[];
  score: number;
}

export interface ArtStyleAnalysis {
  styles: ArtStyleRecommendation[];
  summary: string;
  createdAt: string;
}
