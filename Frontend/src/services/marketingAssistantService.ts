import apiClient from './apiClient';

export interface ProductMarketingCopy {
  title: string;
  description: string;
  socialCopy: string;
  tags: string[];
}

export interface MarketingGenerationUsage {
  used: number;
  limit: number;
}

export interface GenerateProductMarketingCopyResult {
  data: ProductMarketingCopy;
  usage: MarketingGenerationUsage;
}

// Backs the VIP "AI Marketing Assistant" panel on /dashboard?tab=products
// (Backend/src/routes/ai.ts's POST /ai/digital-store-marketing). Server-
// enforced 5/24h quota — a 429 carries the same `usage` shape as a 200 so
// the caller can update the "X/5 today" badge either way.
export async function getMarketingAssistantUsage(): Promise<MarketingGenerationUsage> {
  const response = await apiClient.get<{ usage: MarketingGenerationUsage }>('/ai/digital-store-marketing/usage');
  return response.data.usage;
}

export async function generateProductMarketingCopy(params: {
  title: string;
  description: string;
  category: string;
  lang: 'ka' | 'en';
  productId?: string;
}): Promise<GenerateProductMarketingCopyResult> {
  const response = await apiClient.post<GenerateProductMarketingCopyResult>('/ai/digital-store-marketing', params);
  return response.data;
}
