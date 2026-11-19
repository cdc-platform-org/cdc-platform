/**
 * Single access decision for every AI tool (config/digitalTools.ts keys).
 * Exports: resolveDigitalToolAccess, hasDigitalToolAccess,
 * requireDigitalToolAccess (Express middleware, optionally metering a trial).
 *
 * Access sources, checked in this order:
 *   ADMIN        — internal admin team / SuperAdmin.
 *   PAID         — the tool's own paid product (Educator VIP, tutor Pro, a paid
 *                  chatbot agent, coloring credits, AI Agents Suite billing) or
 *                  the 30-day AI tool purchase (AccessGrant AI_TOOL_SUBSCRIPTION:).
 *   COURSE       — an unfinished paid course that lists this tool (Course.aiToolKeys).
 *   GRANT        — any other admin AccessGrant.
 *   LEGACY_TRIAL — a 5-day trial started before trials were unified (uncapped,
 *                  expires on its own).
 *   TRIAL        — the unified 3-day trial with a usage cap (aiToolTrialService).
 * Trial start / checkout routes: routes/digitalTools.ts, routes/payments/aiToolCheckout.ts.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { digitalToolLinkedProductId, isDigitalToolKey } from '../../config/digitalTools';
import { AI_TOOL_PAYMENT_NOTE } from '../../config/aiToolSubscriptions';
import { resolveStudentWorkspaceAccess } from '../workspaceAccessService';
import { getSubscriptionState } from '../payments/subscriptionStateService';
import { hasCourseToolAccess } from '../learning/collegeAiAccessService';
import { hasAccessGrant } from '../account/accessGrantService';
import { consumeAiToolTrialUnits, getAiToolTrialStatus, refundAiToolTrialUnits, type AiToolTrialStatus } from './aiToolTrialService';

// FREE = coloring pages' one free first page (usable, but nothing bought yet).
export type DigitalToolAccessSource = 'ADMIN' | 'PAID' | 'COURSE' | 'GRANT' | 'LEGACY_TRIAL' | 'TRIAL' | 'FREE' | 'NONE';

export interface DigitalToolAccess {
  allowed: boolean;
  source: DigitalToolAccessSource;
  // When the current access source ends (null = open-ended or unknown).
  endsAt: Date | null;
  trial: AiToolTrialStatus;
}

const now = () => Date.now();
const future = (date: Date | null | undefined) => !!date && date.getTime() > now();

async function activeSubscriptionGrant(userId: string, toolKey: string) {
  return prisma.accessGrant.findFirst({
    where: { userId, resourceType: 'DIGITAL_TOOL', resourceId: toolKey, revokedAt: null, note: { startsWith: AI_TOOL_PAYMENT_NOTE }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
    select: { expiresAt: true },
  });
}

// The tool's own pre-existing paid product (not the generic 30-day grant).
async function toolSpecificPaidAccess(userId: string, toolKey: string): Promise<{ paid: boolean; legacyTrialEndsAt: Date | null; endsAt: Date | null; free?: boolean }> {
  const none = { paid: false, legacyTrialEndsAt: null, endsAt: null };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { educatorVipActive: true, educatorVipTrialEndDate: true, educatorVipPaidUntil: true, tutorSubscriptionTier: true, tutorTrialEndDate: true, tutorSubscriptionPeriodEnd: true },
  });
  if (!user) return none;
  if (toolKey === 'educator-hub') {
    if (user.educatorVipActive) return { paid: true, legacyTrialEndsAt: null, endsAt: null };
    if (future(user.educatorVipPaidUntil)) return { paid: true, legacyTrialEndsAt: null, endsAt: user.educatorVipPaidUntil };
    if (future(user.educatorVipTrialEndDate)) return { paid: false, legacyTrialEndsAt: user.educatorVipTrialEndDate, endsAt: null };
  }
  if (toolKey === 'english-tutor') {
    if (user.tutorSubscriptionTier === 'PRO' && (!user.tutorSubscriptionPeriodEnd || future(user.tutorSubscriptionPeriodEnd))) {
      return { paid: true, legacyTrialEndsAt: null, endsAt: user.tutorSubscriptionPeriodEnd };
    }
    if (future(user.tutorTrialEndDate)) return { paid: false, legacyTrialEndsAt: user.tutorTrialEndDate, endsAt: null };
  }
  if (toolKey === 'ai-agents') {
    const state = await getSubscriptionState(userId);
    if (state.hasAccess && state.source === 'LEGACY_TRIAL_FLAG' && state.trialEndsAt) return { paid: false, legacyTrialEndsAt: state.trialEndsAt, endsAt: null };
    if (state.hasAccess && ['BILLING_SUBSCRIPTION', 'LEGACY_TRIAL_FLAG'].includes(state.source)) return { paid: true, legacyTrialEndsAt: null, endsAt: state.trialEndsAt };
  }
  if (toolKey === 'chatbot-builder') {
    const agent = await prisma.agent.findFirst({ where: { businessId: userId, status: { in: ['ACTIVE', 'PAUSED'] }, paidUntil: { gt: new Date() } }, orderBy: { paidUntil: 'desc' }, select: { paidUntil: true } });
    if (agent) return { paid: true, legacyTrialEndsAt: null, endsAt: agent.paidUntil };
  }
  if (toolKey === 'coloring-pages') {
    // Bought credits, or the one free first page every account gets.
    const account = await prisma.coloringAccount.findUnique({ where: { userId }, select: { balance: true, freeUsed: true } });
    if (account && account.balance > 0) return { paid: true, legacyTrialEndsAt: null, endsAt: null };
    if (!account || !account.freeUsed) return { paid: false, free: true, legacyTrialEndsAt: null, endsAt: null };
  }
  if (toolKey === 'design-studio' || toolKey === 'code-studio') {
    // Workspace studios keep their own subscription lookup (same AccessGrant rows).
    const workspace = await resolveStudentWorkspaceAccess(userId);
    const source = toolKey === 'design-studio' ? workspace.designAccessSource : workspace.codeAccessSource;
    const expires = toolKey === 'design-studio' ? workspace.designAccessExpiresAt : workspace.codeAccessExpiresAt;
    if (source === 'SUBSCRIPTION') return { paid: true, legacyTrialEndsAt: null, endsAt: expires ? new Date(expires) : null };
  }
  const linkedProductId = digitalToolLinkedProductId(toolKey);
  if (linkedProductId) {
    const purchase = await prisma.productPurchase.findUnique({ where: { userId_productId: { userId, productId: linkedProductId } }, select: { paymentStatus: true } });
    if (purchase?.paymentStatus === 'COMPLETED') return { paid: true, legacyTrialEndsAt: null, endsAt: null };
  }
  return none;
}

export async function resolveDigitalToolAccess(userId: string, email: string | null | undefined, toolKey: string): Promise<DigitalToolAccess> {
  const trial = await getAiToolTrialStatus(userId, toolKey);
  const deny: DigitalToolAccess = { allowed: false, source: 'NONE', endsAt: null, trial };
  if (!isDigitalToolKey(toolKey)) return deny;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true } });
  if (!user) return deny;
  if (user.adminRole || user.role === 'SuperAdmin') return { allowed: true, source: 'ADMIN', endsAt: null, trial };

  const subscription = await activeSubscriptionGrant(userId, toolKey);
  const specific = await toolSpecificPaidAccess(userId, toolKey);
  if (subscription || specific.paid) {
    const ends = [subscription?.expiresAt ?? null, specific.endsAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return { allowed: true, source: 'PAID', endsAt: ends, trial };
  }
  if (await hasCourseToolAccess(userId, toolKey)) return { allowed: true, source: 'COURSE', endsAt: null, trial };
  if (await hasAccessGrant('DIGITAL_TOOL', toolKey, { userId, email })) return { allowed: true, source: 'GRANT', endsAt: null, trial };
  if (specific.legacyTrialEndsAt) return { allowed: true, source: 'LEGACY_TRIAL', endsAt: specific.legacyTrialEndsAt, trial };
  if (trial.state === 'ACTIVE') return { allowed: true, source: 'TRIAL', endsAt: trial.endsAt, trial };
  if (specific.free) return { allowed: true, source: 'FREE', endsAt: null, trial };
  return deny;
}

export async function hasDigitalToolAccess(userId: string, email: string | null | undefined, toolKey: string): Promise<boolean> {
  return (await resolveDigitalToolAccess(userId, email, toolKey)).allowed;
}

/** Machine-readable reason the Frontend paywall uses to pick its message. */
export function lockedCode(access: DigitalToolAccess): 'TRIAL_LIMIT_REACHED' | 'TRIAL_EXPIRED' | 'TOOL_LOCKED' {
  if (access.trial.state === 'EXHAUSTED') return 'TRIAL_LIMIT_REACHED';
  if (access.trial.state === 'EXPIRED') return 'TRIAL_EXPIRED';
  return 'TOOL_LOCKED';
}

export function lockedResponse(res: Response, toolKey: string, access: DigitalToolAccess) {
  const code = lockedCode(access);
  const message = code === 'TRIAL_LIMIT_REACHED'
    ? 'You have used all free trial actions for this tool. Buy access to keep going.'
    : code === 'TRIAL_EXPIRED'
      ? 'Your free trial for this tool has ended. Buy access to keep going.'
      : 'This tool needs access. Start the free trial or buy access.';
  return res.status(403).json({ code, toolKey, message, paywall: true });
}

declare global {
  namespace Express {
    interface Locals {
      toolAccess?: DigitalToolAccess;
    }
  }
}

/**
 * Express middleware for a Digital Tool's own backend routes. `meter` spends
 * that many trial units when the caller's ONLY access is the 3-day trial —
 * put it on the endpoints that call a paid AI provider, never on reads.
 */
export function requireDigitalToolAccess(toolKey: string, options: { meter?: number } = {}) {
  if (!isDigitalToolKey(toolKey)) throw new Error(`Unknown Digital Tool key: ${toolKey}`);
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const access = await resolveDigitalToolAccess(req.user!.id, req.user!.email, toolKey);
      if (!access.allowed) return lockedResponse(res, toolKey, access);
      if (access.source === 'TRIAL' && options.meter) {
        const units = options.meter;
        if (!await consumeAiToolTrialUnits(req.user!.id, toolKey, units)) {
          return lockedResponse(res, toolKey, { ...access, allowed: false, trial: { ...access.trial, state: 'EXHAUSTED', remaining: 0 } });
        }
        // Any failed request (bad input, rate limit, provider error) gives the
        // unit back — a trial only pays for results the user actually got.
        const userId = req.user!.id;
        res.once('finish', () => {
          if (res.statusCode >= 400) refundAiToolTrialUnits(userId, toolKey, units).catch(err => console.error('[ai-trial] refund failed:', err));
        });
      }
      res.locals.toolAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}
