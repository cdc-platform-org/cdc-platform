import apiClient from './apiClient';
import { User } from '../types/auth';

// Legacy display helper. Use getAiAgentsSuiteState for full server-side college/subscription access.
export function hasAiAgentsSuiteAccess(user: Pick<User, 'role' | 'aiTrialEndsAt' | 'aiSubscriptionActive'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  return user.role === 'Client' && (user.aiSubscriptionActive || !!(user.aiTrialEndsAt && Date.parse(user.aiTrialEndsAt) > Date.now()));
}

// Whole days remaining until the trial expires — 0 once it's expired
// (never negative), so the banner can show "დარჩენილია 0 დღე" instead of a
// confusing negative number for the brief window right at expiry.
export function aiTrialDaysRemaining(aiTrialEndsAt: string | null): number {
  if (!aiTrialEndsAt) return 0;
  const msRemaining = new Date(aiTrialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

export type AiAgentSuiteTool = 'content' | 'analytics' | 'assistant';

export async function generateWithAiAgent(tool: AiAgentSuiteTool, prompt: string, lang: 'ka' | 'en'): Promise<string> {
  const response = await apiClient.post<{ data: { response: string } }>('/ai-agents/generate', { tool, prompt, lang });
  return response.data.data.response;
}


export async function getAiAgentsSuiteState(): Promise<{ hasAccess: boolean; source: string; accessSource?: string; trialEndsAt?: string | null }> {
  const response = await apiClient.get<{ data: { hasAccess: boolean; source: string; accessSource?: string; trialEndsAt?: string | null } }>('/ai-agents/state');
  return response.data.data;
}
