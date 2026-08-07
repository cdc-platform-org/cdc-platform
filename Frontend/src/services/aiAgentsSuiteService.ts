import apiClient from './apiClient';
import { User } from '../types/auth';

// Mirrors Backend's utils/aiAgentsSuiteAccess.ts exactly — display-only
// here (the real enforcement is server-side in routes/aiAgentsSuite.ts's
// POST /generate, which re-checks this from scratch on every call).
export function hasAiAgentsSuiteAccess(user: Pick<User, 'role' | 'aiTrialEndsAt' | 'aiSubscriptionActive'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  if (user.role !== 'Client') return false;
  if (user.aiSubscriptionActive) return true;
  return !!user.aiTrialEndsAt && new Date(user.aiTrialEndsAt).getTime() > Date.now();
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
