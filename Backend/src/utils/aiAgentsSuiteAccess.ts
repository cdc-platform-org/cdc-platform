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

// Every approved account has full access, regardless of role or
// trial/subscription state — the Employment Forum (forum.ts's
// isVerifiedGraduate gate) is the only tier-restricted feature on the
// platform. aiTrialEndsAt/aiSubscriptionActive are kept on the schema (and
// still shown in the UI where set) for historical/display purposes only;
// they no longer gate anything here.
export function hasAiAgentsSuiteAccess(user: AiAgentsSuiteAccessUser | null | undefined): boolean {
  return !!user;
}
