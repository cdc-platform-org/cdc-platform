import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { CRON_SECRET } from '../utils/env';
import { autoApproveOverdueGigs } from '../services/gigApprovalService';
import { cleanupExpiredDeletedAccounts } from '../services/accountCleanupService';
import { pauseExpiredTrialAgents } from '../services/agentBillingService';
import { sweepExpiredTrials, rolloverActiveBillingPeriods, sweepTrialEndingWarnings, sweepRenewalReminders } from '../services/billingService';
import { cancelAbandonedMentorshipBookings } from '../services/mentorAvailabilityService';
import { autoReleaseMentorshipEscrows } from '../services/mentorshipEscrowService';
import { autoReleaseHRSupportEscrows } from '../services/hrSupportEscrowService';
import { expireOverdueVacancies } from '../services/listingExpiryService';
import { reconcilePendingPayments } from '../services/paymentReconciliationService';
import { generateAndSaveBlogDraft, BlogAgentError } from '../services/blogAgentService';
import { AiAgentError } from '../services/aiAgentService';
import { scanAllActiveSources } from '../services/grantScoutService';

const router = Router();
const expectedSecretBuffer = Buffer.from(CRON_SECRET);

// No JWT here on purpose — this is called by an external scheduler (Azure
// Logic App / GitHub Actions cron / cron-job.org), not a logged-in user.
// Auth is a shared secret header instead, same shape as a webhook.
function requireCronSecret(req: Request, res: Response, next: () => void) {
  const provided = req.headers['x-cron-secret'];
  const providedBuffer = Buffer.from(typeof provided === 'string' ? provided : '');
  // crypto.timingSafeEqual throws on a length mismatch, so that check has
  // to happen first — but doing it as a plain !== short-circuit (like the
  // previous `provided !== CRON_SECRET`) would let an attacker binary-search
  // the secret's length via response timing before ever reaching the
  // constant-time byte comparison. A length mismatch is itself treated as
  // "not equal" without comparing bytes, same as tsscmp/most timing-safe
  // string-compare helpers.
  const isValid = providedBuffer.length === expectedSecretBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedSecretBuffer);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid or missing cron secret.' });
  }
  next();
}

router.post('/auto-approve', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await autoApproveOverdueGigs();
  res.json({
    message: `Auto-approved ${result.processedGigIds.length} gig(s) submitted more than 7 days ago.`,
    ...result,
  });
});

router.post('/cleanup-deleted-accounts', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await cleanupExpiredDeletedAccounts();
  res.json({
    message: `Cleaned up ${result.hardDeletedUserIds.length + result.anonymizedUserIds.length} account(s) deleted more than 60 days ago (${result.hardDeletedUserIds.length} hard-deleted, ${result.anonymizedUserIds.length} anonymized).`,
    ...result,
  });
});

router.post('/pause-expired-trial-agents', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await pauseExpiredTrialAgents();
  res.json({
    message: `Paused ${result.pausedAgentIds.length} CDC Business AI agent(s) past their trial end date.`,
    ...result,
  });
});

// BillingSubscription counterpart to the sweep above — separate cron route
// since BillingSubscription (new, unified billing) and Agent.status (legacy,
// per-agent-only) are independent trial mechanisms today; see
// billingService.sweepExpiredTrials's own comment.
router.post('/sweep-expired-billing-trials', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await sweepExpiredTrials();
  res.json({
    message: `${result.activatedIds.length} subscription(s) activated, ${result.pastDueIds.length} marked past-due.`,
    ...result,
  });
});

// Advances every ACTIVE subscription past the end of its tracked cycle —
// see billingService.rolloverActiveBillingPeriods's own comment for why
// this still never attempts a real charge.
router.post('/rollover-billing-periods', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await rolloverActiveBillingPeriods();
  res.json({
    message: `${result.rolledOverIds.length} subscription(s) rolled to a new cycle, ${result.pastDueIds.length} marked past-due.`,
    ...result,
  });
});

// Ethical-billing commitment: 1-day trial-ending warning (email + in-app
// notification). See billingService.sweepTrialEndingWarnings.
router.post('/sweep-billing-trial-warnings', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await sweepTrialEndingWarnings();
  res.json({ message: `${result.notifiedIds.length} trial-ending warning(s) sent.`, ...result });
});

// Ethical-billing commitment: pre-debit reminder ahead of a recurring
// charge (email + in-app notification), only for subscriptions the user
// actually opted auto-renew on. See billingService.sweepRenewalReminders.
router.post('/sweep-billing-renewal-reminders', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await sweepRenewalReminders();
  res.json({ message: `${result.notifiedIds.length} pre-debit reminder(s) sent.`, ...result });
});

// Scheduled three times a week (Mon/Wed/Fri, 10:00 AM) by Frontend's Vercel
// Cron (pages/api/cron/generate-blog.ts) — autonomously drafts one bilingual
// tech/AI blog post. Published immediately only when an admin has opted
// into AiAutomationSettings.blogAutoPublish (off by default — every draft
// then lands unpublished for review instead). See services/blogAgentService.ts.
router.post('/generate-blog-draft', requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const result = await generateAndSaveBlogDraft();
    res.json({ message: `Drafted blog post "${result.title}" for review.`, ...result });
  } catch (err) {
    if (err instanceof BlogAgentError || err instanceof AiAgentError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

// Scheduled once daily by Frontend's Vercel Cron (pages/api/cron/scan-grants.ts)
// — scans every active GrantSource for new funding opportunities. Never
// throws: scanAllActiveSources() catches per-source failures internally and
// always returns a summary, same "no-op rather than fail the workflow"
// posture as qa-autofix's billing-error handling.
router.post('/scan-grant-opportunities', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await scanAllActiveSources();
  res.json({
    message: `Scanned ${result.sourcesScanned} source(s) (${result.sourcesFailed} failed): ${result.newOpportunities} new opportunit(ies), ${result.newlyEligible} eligible.`,
    ...result,
  });
});

// Frees mentor slots blocked by an abandoned/never-completed checkout —
// see mentorAvailabilityService.cancelAbandonedMentorshipBookings.
router.post('/cancel-abandoned-mentorship-bookings', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await cancelAbandonedMentorshipBookings();
  res.json({ message: `${result.cancelledIds.length} abandoned booking(s) cancelled.`, ...result });
});

// Releases mentorship escrow 24h past the session's scheduled end with no
// dispute raised — see mentorshipEscrowService.autoReleaseMentorshipEscrows.
router.post('/auto-release-mentorship-escrow', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await autoReleaseMentorshipEscrows();
  res.json({ message: `${result.releasedIds.length} session(s) auto-released.`, ...result });
});

// Releases HR Assistance escrow 5 days past delivery with no dispute raised
// — see hrSupportEscrowService.autoReleaseHRSupportEscrows.
router.post('/auto-release-hr-support-escrow', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await autoReleaseHRSupportEscrows();
  res.json({ message: `${result.releasedIds.length} request(s) auto-released.`, ...result });
});

// Closes any vacancy whose application deadline has passed — see
// listingExpiryService.expireOverdueVacancies.
router.post('/expire-overdue-vacancies', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await expireOverdueVacancies();
  res.json({ message: `${result.closedIds.length} vacancy(ies) closed.`, ...result });
});

// Recovers a payment stuck PENDING for 30+ minutes (a user who closed their
// tab mid-checkout, so BOG's/Stripe's own callback/webhook never fired) by
// asking the gateway itself for the order/session's real current status —
// see paymentReconciliationService.reconcilePendingPayments.
router.post('/reconcile-pending-payments', requireCronSecret, async (_req: Request, res: Response) => {
  const result = await reconcilePendingPayments();
  res.json({
    message: `BOG: ${result.bogCompletedIds.length} completed, ${result.bogFailedIds.length} failed. Stripe: ${result.stripeCompletedIds.length} completed, ${result.stripeFailedIds.length} failed. ${result.errorIds.length} error(s).`,
    ...result,
  });
});

export default router;
