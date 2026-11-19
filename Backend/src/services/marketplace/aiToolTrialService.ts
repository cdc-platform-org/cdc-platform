/**
 * One free 3-day trial per user per AI tool, capped in the tool's cost unit
 * (rules: config/aiToolTrials.ts, row: prisma AiToolTrial).
 * Exports: getAiToolTrialStatus, startAiToolTrial, consumeAiToolTrialUnits,
 * AiToolTrialError. Access resolution that decides WHEN a trial is the
 * user's access source lives in digitalToolAccessService.ts.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AI_TOOL_TRIAL_DAYS, aiToolTrialRule, type AiToolTrialUnit } from '../../config/aiToolTrials';

const DAY_MS = 86_400_000;

export type AiToolTrialErrorCode = 'TRIAL_NOT_OFFERED' | 'TRIAL_ALREADY_USED';
export class AiToolTrialError extends Error {
  constructor(public code: AiToolTrialErrorCode, message: string) { super(message); }
}

export interface AiToolTrialStatus {
  // AVAILABLE = never started; ACTIVE = inside the window with units left;
  // EXHAUSTED = cap reached before the window ended; EXPIRED = window over.
  state: 'AVAILABLE' | 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'NOT_OFFERED';
  days: number;
  cap: number;
  unit: AiToolTrialUnit | null;
  used: number;
  remaining: number;
  endsAt: Date | null;
}

// Older per-tool trials (5-day tutor / educator, the AI Agents Suite trial)
// count as the user's one trial for that tool, so nobody gets a second
// free window just because the trial system was unified.
async function usedLegacyTrial(userId: string, toolKey: string): Promise<boolean> {
  if (!['english-tutor', 'educator-hub', 'ai-agents'].includes(toolKey)) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tutorTrialStartDate: true, educatorVipTrialStartDate: true, trialStartDate: true },
  });
  if (!user) return false;
  if (toolKey === 'english-tutor') return !!user.tutorTrialStartDate;
  if (toolKey === 'educator-hub') return !!user.educatorVipTrialStartDate;
  return !!user.trialStartDate;
}

export async function getAiToolTrialStatus(userId: string, toolKey: string, now = new Date()): Promise<AiToolTrialStatus> {
  const rule = aiToolTrialRule(toolKey);
  if (!rule) return { state: 'NOT_OFFERED', days: 0, cap: 0, unit: null, used: 0, remaining: 0, endsAt: null };
  const base = { days: AI_TOOL_TRIAL_DAYS, cap: rule.cap, unit: rule.unit };
  const trial = await prisma.aiToolTrial.findUnique({ where: { userId_toolKey: { userId, toolKey } } });
  if (!trial) {
    if (await usedLegacyTrial(userId, toolKey)) return { ...base, state: 'EXPIRED', used: 0, remaining: 0, endsAt: null };
    return { ...base, state: 'AVAILABLE', used: 0, remaining: rule.cap, endsAt: null };
  }
  const remaining = Math.max(0, trial.capUnits - trial.usedUnits);
  const state = trial.endsAt <= now ? 'EXPIRED' : remaining <= 0 ? 'EXHAUSTED' : 'ACTIVE';
  return { ...base, cap: trial.capUnits, state, used: trial.usedUnits, remaining, endsAt: trial.endsAt };
}

/** Starts the user's one trial for this tool. Never extends or restarts an existing one. */
export async function startAiToolTrial(userId: string, toolKey: string): Promise<AiToolTrialStatus> {
  const rule = aiToolTrialRule(toolKey);
  if (!rule) throw new AiToolTrialError('TRIAL_NOT_OFFERED', 'This tool has no free trial.');
  if (await usedLegacyTrial(userId, toolKey)) throw new AiToolTrialError('TRIAL_ALREADY_USED', 'You have already used the free trial for this tool.');
  const now = new Date();
  try {
    await prisma.aiToolTrial.create({
      data: { userId, toolKey, startedAt: now, endsAt: new Date(now.getTime() + AI_TOOL_TRIAL_DAYS * DAY_MS), capUnits: rule.cap },
    });
  } catch (err) {
    // The (userId, toolKey) unique index is the once-only guarantee, also
    // under two concurrent clicks.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AiToolTrialError('TRIAL_ALREADY_USED', 'You have already used the free trial for this tool.');
    }
    throw err;
  }
  return getAiToolTrialStatus(userId, toolKey, now);
}

/**
 * Atomically spends `units` of an active trial. Returns false (and spends
 * nothing) when the trial is over, missing, or would go past its cap — the
 * caller then answers with a TRIAL_LIMIT_REACHED paywall instead of calling
 * the AI provider.
 */
export async function consumeAiToolTrialUnits(userId: string, toolKey: string, units = 1, client: Prisma.TransactionClient = prisma): Promise<boolean> {
  if (units <= 0) return true;
  const trial = await client.aiToolTrial.findUnique({ where: { userId_toolKey: { userId, toolKey } }, select: { id: true, capUnits: true } });
  if (!trial) return false;
  const claimed = await client.aiToolTrial.updateMany({
    where: { id: trial.id, endsAt: { gt: new Date() }, usedUnits: { lte: trial.capUnits - units } },
    data: { usedUnits: { increment: units } },
  });
  return claimed.count === 1;
}

/** Gives units back when the metered AI call failed before producing anything. */
export async function refundAiToolTrialUnits(userId: string, toolKey: string, units = 1): Promise<void> {
  if (units <= 0) return;
  await prisma.aiToolTrial.updateMany({
    where: { userId, toolKey, usedUnits: { gte: units } },
    data: { usedUnits: { decrement: units } },
  });
}
