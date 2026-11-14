// API client for the product agent admin page (/admin/product-agent).
// Backend: Backend/src/routes/admin/adminProductAgent.ts. Approving or
// editing an agent product uses the normal productService admin calls.
import apiClient from './apiClient';

export type AgentCategoryKey =
  | 'PRINTS'
  | 'KIDS_WORKSHEETS'
  | 'PLANNERS'
  | 'CV_TEMPLATES'
  | 'BUSINESS_TEMPLATES'
  | 'INVITATIONS'
  | 'EXAM_PREP';

export interface ProductAgentSettings {
  enabled: boolean;
  dailyCounts: Record<AgentCategoryKey, number>;
  imageQuality: 'high' | 'medium';
  monthlyBudgetUsd: number;
  runHourUtc: number;
}

export interface AgentCategory {
  key: AgentCategoryKey;
  labelKa: string;
  labelEn: string;
  storeCategory: string;
  defaultPriceGel: number;
  estimatedCostUsd: number;
  needsFactCheck: boolean;
}

export interface AgentRun {
  id: string;
  category: AgentCategoryKey;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  trigger: 'SCHEDULE' | 'MANUAL';
  theme: string | null;
  productId: string | null;
  imageCount: number;
  estimatedCostUsd: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AgentProduct {
  id: string;
  title: string;
  titleEn: string | null;
  category: string;
  status: string;
  imageUrl: string;
  price: number;
  createdAt: string;
  salesCount: number;
}

export interface TrendBrief {
  id: string;
  category: AgentCategoryKey;
  themes: { theme: string; why: string; styleNotes?: string }[];
  summary: string;
  costUsd: number;
  createdAt: string;
}

export interface ProductAgentOverview {
  settings: ProductAgentSettings;
  spend: { todayUsd: number; monthUsd: number; monthProducts: number };
  busy: boolean;
  configured: boolean;
  categories: AgentCategory[];
  runs: AgentRun[];
  products: AgentProduct[];
  trendBriefs: TrendBrief[];
}

export async function getProductAgentOverview(): Promise<ProductAgentOverview> {
  const res = await apiClient.get<{ data: ProductAgentOverview }>('/admin/product-agent');
  return res.data.data;
}

export async function updateProductAgentSettings(payload: Partial<ProductAgentSettings>): Promise<ProductAgentSettings> {
  const res = await apiClient.put<{ data: ProductAgentSettings }>('/admin/product-agent/settings', payload);
  return res.data.data;
}

export async function runProductAgent(categories: AgentCategoryKey[]): Promise<string[]> {
  const res = await apiClient.post<{ data: { runIds: string[] } }>('/admin/product-agent/run', { categories });
  return res.data.data.runIds;
}

// `reason` is remembered so the agent avoids similar products later.
export async function deleteAgentProduct(id: string, reason?: string): Promise<void> {
  await apiClient.delete(`/admin/product-agent/products/${id}`, { data: { reason } });
}

export async function refreshTrendBriefs(categories?: AgentCategoryKey[]): Promise<void> {
  // Runs in the background on the server; new briefs appear in 1–2 minutes.
  await apiClient.post('/admin/product-agent/trends/refresh', { categories });
}
