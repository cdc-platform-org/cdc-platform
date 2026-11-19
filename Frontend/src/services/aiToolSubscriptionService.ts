// API client for AI tool access: catalog (prices + trial rules), the caller's
// access state, starting the 3-day trial, and checkout (30-day purchase or
// coloring credit packs, both with promo / gift card codes).
// Backend: routes/digitalTools.ts, routes/payments/aiToolCheckout.ts.
import apiClient from './apiClient';

export type AiToolPricingModel = 'MONTHLY' | 'PER_BOOK' | 'CREDIT_PACKS';
export type AiToolAccessSource = 'ADMIN' | 'PAID' | 'COURSE' | 'GRANT' | 'LEGACY_TRIAL' | 'TRIAL' | 'NONE';
export type AiToolLockedReason = 'TRIAL_LIMIT_REACHED' | 'TRIAL_EXPIRED' | 'TOOL_LOCKED';
export type AiToolUnit = 'book' | 'request' | 'generation' | 'message' | 'exam' | 'page';

export interface AiToolPricing { model: AiToolPricingModel | null; priceMinor: number | null; maxPriceMinor?: number; periodDays: number | null; }
export interface AiToolTrialState {
  state: 'AVAILABLE' | 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'NOT_OFFERED';
  days: number; cap: number; unit: AiToolUnit | null; used: number; remaining: number; endsAt: string | null;
}
export interface AiToolSubscriptionState {
  allowed: boolean;
  source: AiToolAccessSource;
  accessEndsAt: string | null;
  lockedReason: AiToolLockedReason | null;
  trial: AiToolTrialState;
  collegeAccess: boolean;
  collegeAccessEndsAt?: string | null;
  collegeAccessEnded?: boolean;
  subscriptionEndsAt: string | null;
  pricing: AiToolPricing;
  priceMinor: number | null;
  periodDays: number | null;
}
export interface AiToolCatalogEntry extends AiToolPricing { key: string; trial: { days: number; cap: number; unit: AiToolUnit } | null; }
export interface AiToolCheckoutResult { paymentId?: string; redirectUrl: string | null; enrolled?: boolean; included?: boolean; purchased?: boolean; }

let catalogPromise: Promise<AiToolCatalogEntry[]> | null = null;
export function getAiToolSubscriptionCatalog(): Promise<AiToolCatalogEntry[]> {
  if (!catalogPromise) catalogPromise = apiClient.get<{ data: AiToolCatalogEntry[] }>('/digital-tools/catalog').then(response => response.data.data).catch(error => { catalogPromise = null; throw error; });
  return catalogPromise;
}
export async function getAiToolSubscriptionState(key: string): Promise<AiToolSubscriptionState> {
  return (await apiClient.get<{ data: AiToolSubscriptionState }>(`/digital-tools/${encodeURIComponent(key)}/access`)).data.data;
}
export async function startAiToolTrial(key: string): Promise<AiToolTrialState> {
  return (await apiClient.post<{ data: { trial: AiToolTrialState } }>(`/digital-tools/${encodeURIComponent(key)}/trial`, {})).data.data.trial;
}
export async function checkoutAiToolSubscription(key: string, lang: string, promoCode?: string): Promise<AiToolCheckoutResult> {
  return (await apiClient.post<AiToolCheckoutResult>(`/payments/checkout/ai-tool/${encodeURIComponent(key)}`, { lang, ...(promoCode ? { promoCode } : {}) })).data;
}
export async function checkoutColoringPack(packId: string, lang: string, promoCode?: string): Promise<AiToolCheckoutResult> {
  return (await apiClient.post<AiToolCheckoutResult>(`/payments/checkout/coloring-credits/${encodeURIComponent(packId)}`, { lang, ...(promoCode ? { promoCode } : {}) })).data;
}

// A tool's own API answers 403 { paywall: true, code, toolKey } when the
// trial ran out mid-session; apiClient re-broadcasts it as this event so the
// open DigitalToolAccessGate swaps to the paywall instead of a dead end.
export const TOOL_PAYWALL_EVENT = 'cdc:tool-paywall';
export interface ToolPaywallEventDetail { toolKey: string; code: AiToolLockedReason; }

export const AI_TOOL_DESTINATIONS: Record<string, string> = {
  'design-studio': '/dashboard/tools/design-studio', 'code-studio': '/dashboard/tools/code-studio',
  'english-tutor': '/dashboard/english-tutor', 'educator-hub': '/dashboard/tools/educator-hub',
  'media-studio': '/dashboard/tools/media-studio', 'chatbot-builder': '/dashboard/tools/chatbot-builder',
  proctoring: '/dashboard/tools/proctored-exam', 'smart-reader': '/dashboard/tools/smart-reader',
  'ai-agents': '/dashboard/ai-tools', 'childrens-book': '/dashboard/tools/childrens-book',
  'coloring-pages': '/dashboard/tools/coloring-pages',
};
