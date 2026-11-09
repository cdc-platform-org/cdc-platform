import { prisma } from '../lib/prisma';

// ============================================================
// CDC Business AI agent: paid 30-day periods bought through BOG
// (BogPaymentPurpose BUSINESS_AI_AGENT, referenceId = Agent.id).
// No recurring charge: when Agent.paidUntil passes, the hourly sweep in
// agentBillingService pauses the agent and the owner pays again.
// ============================================================

export const BUSINESS_AI_PRICE_GEL = 4900; // 49.00 GEL, minor units (tetri)
export const BUSINESS_AI_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AgentCheckoutError extends Error {
  constructor(message: string, public code: 'NOT_FOUND' | 'AGENT_LIMIT_REACHED') {
    super(message);
    this.name = 'AgentCheckoutError';
  }
}

// Checks run before a BOG order is opened: the agent must be the buyer's,
// and paying for it must not leave the account with more than one running
// agent (the Starter plan limit enforced in routes/agents.ts).
export async function assertAgentPurchasable(agentId: string, userId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true, businessId: true } });
  if (!agent || agent.businessId !== userId) throw new AgentCheckoutError('Agent not found.', 'NOT_FOUND');
  const others = await prisma.agent.count({ where: { businessId: userId, id: { not: agentId }, status: { in: ['TRIAL', 'ACTIVE'] } } });
  if (others > 0) {
    throw new AgentCheckoutError('You already have another running agent. Pause or delete it first.', 'AGENT_LIMIT_REACHED');
  }
  return agent;
}

// Fulfillment for a confirmed BUSINESS_AI_AGENT payment. Extends from the
// later of now or the current paid period and switches the agent on.
// Returns null when the agent was deleted in the meantime.
export async function completeAgentPurchase(agentId: string): Promise<{ paidUntil: Date } | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { paidUntil: true, status: true, trialEndsAt: true } });
  if (!agent) return null;
  // Paying during the trial keeps the remaining free days: the paid month
  // starts when the trial would have ended.
  const now = Date.now();
  const trialLeft = agent.status === 'TRIAL' ? agent.trialEndsAt.getTime() : 0;
  const base = Math.max(now, agent.paidUntil?.getTime() ?? 0, trialLeft);
  const paidUntil = new Date(base + BUSINESS_AI_PERIOD_DAYS * DAY_MS);
  await prisma.agent.update({ where: { id: agentId }, data: { paidUntil, status: 'ACTIVE' } });
  return { paidUntil };
}
