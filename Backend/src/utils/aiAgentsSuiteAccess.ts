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

export function hasAiAgentsSuiteAccess(user: AiAgentsSuiteAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  // Trial/subscription only ever grants access for a Business (Client)
  // account — belt-and-suspenders on top of the fact that both write paths
  // (setVerified, PATCH /admin/users/:id/ai-trial) already only ever touch
  // a Client account's row.
  if (user.role !== 'Client') return false;
  if (user.aiSubscriptionActive) return true;
  return !!user.aiTrialEndsAt && user.aiTrialEndsAt.getTime() > Date.now();
}
