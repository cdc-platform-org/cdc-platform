import apiClient from './apiClient';
export interface AiToolSubscriptionState { allowed: boolean; collegeAccess: boolean; subscriptionEndsAt: string | null; priceMinor: number; periodDays: number; }
export interface AiToolCatalogEntry { key: string; priceMinor: number; periodDays: number; }
let catalogPromise: Promise<AiToolCatalogEntry[]> | null = null;
export function getAiToolSubscriptionCatalog(): Promise<AiToolCatalogEntry[]> {
  if (!catalogPromise) catalogPromise = apiClient.get<{ data: AiToolCatalogEntry[] }>('/digital-tools/catalog').then(response => response.data.data).catch(error => { catalogPromise = null; throw error; });
  return catalogPromise;
}
export async function getAiToolSubscriptionState(key: string): Promise<AiToolSubscriptionState> {
  return (await apiClient.get<{ data: AiToolSubscriptionState }>(`/digital-tools/${encodeURIComponent(key)}/access`)).data.data;
}
export async function checkoutAiToolSubscription(key: string, lang: 'ka' | 'en') {
  return (await apiClient.post<{ paymentId?: string; redirectUrl: string | null; enrolled?: boolean }>(`/payments/checkout/ai-tool/${encodeURIComponent(key)}`, { lang })).data;
}


export const AI_TOOL_DESTINATIONS: Record<string, string> = {
  'design-studio': '/dashboard/tools/design-studio', 'code-studio': '/dashboard/tools/code-studio',
  'english-tutor': '/dashboard/english-tutor', 'educator-hub': '/dashboard/tools/educator-hub',
  'media-studio': '/dashboard/tools/media-studio', 'chatbot-builder': '/dashboard/tools/chatbot-builder',
  proctoring: '/dashboard/tools/proctored-exam', 'smart-reader': '/dashboard/tools/smart-reader',
  'ai-agents': '/dashboard/ai-tools', 'childrens-book': '/dashboard/tools/childrens-book',
  'coloring-pages': '/dashboard/tools/coloring-pages',
};
