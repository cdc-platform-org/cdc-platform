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
  if (expired.length === 0) return { pausedAgentIds: [] };

  await prisma.agent.updateMany({
    where: { id: { in: expired.map((a) => a.id) } },
    data: { status: 'PAUSED' },
  });
  return { pausedAgentIds: expired.map((a) => a.id) };
}
