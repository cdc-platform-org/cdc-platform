// Access boundary for the Business AI Agents Suite (services/aiAgentService.ts's
// Module 4 + routes/aiAgentsSuite.ts) — distinct from the pre-existing
// Agent.trialEndsAt (that's the per-embeddable-chatbot 60-day trial, a
// separate product with its own lifecycle; see routes/agents.ts and
// services/agentBillingService.ts). This one gates access to the suite of
// internal tools (content generator, market analytics, business assistant)
// on Frontend's /dashboard/ai-tools.
export interface AiAgentsSuiteAccessUser {
  role: string;
  aiTrialEndsAt: Date | null;
  aiSubscriptionActive: boolean;
}

// College access and per-tool paid grants are resolved by subscriptionStateService.
// These legacy flags represent an explicit grant or an unexpired trial only.
export function hasAiAgentsSuiteAccess(user: AiAgentsSuiteAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  if (user.role !== 'Client') return false;
  return user.aiSubscriptionActive || !!(user.aiTrialEndsAt && user.aiTrialEndsAt.getTime() > Date.now());
}
