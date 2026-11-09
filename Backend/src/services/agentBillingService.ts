import { prisma } from '../lib/prisma';

// ============================================================
// Trial-expiry sweep for CDC Business AI agents — the "Non-Invasive Pause"
// half of the billing spec. This only ever flips status to PAUSED; it never
// attempts to charge a card. Real recurring billing (charging a saved card
// via BOG's POST /payments/v1/ecommerce/orders/:parent_order_id) is a
// separate, deferred phase — see the Agent model's own schema comment.
// ============================================================

export interface AgentTrialSweepResult {
  pausedAgentIds: string[];
}

export async function pauseExpiredTrialAgents(): Promise<AgentTrialSweepResult> {
  const expired = await prisma.agent.findMany({
    where: { status: 'TRIAL', trialEndsAt: { lte: new Date() } },
    select: { id: true },
  });
  // A paid period that has run out (see agentSubscriptionService). ACTIVE
  // agents with no paidUntil were switched on by an admin and are left alone.
  const lapsed = await prisma.agent.findMany({
    where: { status: 'ACTIVE', paidUntil: { lte: new Date() } },
    select: { id: true },
  });
  const ids = [...expired, ...lapsed].map((a) => a.id);
  if (ids.length === 0) return { pausedAgentIds: [] };

  await prisma.agent.updateMany({
    where: { id: { in: ids } },
    data: { status: 'PAUSED' },
  });
  return { pausedAgentIds: ids };
}
