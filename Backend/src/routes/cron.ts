import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { CRON_SECRET } from '../utils/env';
import { autoApproveOverdueGigs } from '../services/gigApprovalService';
import { cleanupExpiredDeletedAccounts } from '../services/accountCleanupService';
import { pauseExpiredTrialAgents } from '../services/agentBillingService';
import { generateAndSaveBlogDraft, BlogAgentError } from '../services/blogAgentService';

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
    if (err instanceof BlogAgentError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

export default router;
