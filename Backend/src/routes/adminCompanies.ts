import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { sendBusinessVerifiedEmail, sendBusinessRejectedEmail } from '../services/emailService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const companySelect = {
  id: true,
  name: true,
  email: true,
  companyName: true,
  industry: true,
  websiteUrl: true,
  companyDescription: true,
  avatarUrl: true,
  phone: true,
  taxId: true,
  verificationDocUrl: true,
  isVerified: true,
  verificationStatus: true,
  trialStartDate: true,
  aiTrialEndsAt: true,
  aiSubscriptionActive: true,
  createdAt: true,
  // AI KYC inspection data (see services/businessKycService.ts) — read by
  // the admin inspection drawer's extracted-vs-entered comparison. Null
  // until the business's first document upload.
  businessKycExtractedData: true,
  businessKycScore: true,
  businessKycReasoning: true,
  businessKycCheckedAt: true,
  businessKycRejectionReason: true,
};

const AI_TRIAL_DAYS_ON_FIRST_VERIFY = 7;

// Every Client (Business) account — the frontend derives the three-state
// badge (Unverified / Under Review / Verified) from verificationDocUrl +
// isVerified, same as the dashboard does for its own account. `status`
// also accepts 'pending'/'rejected' against the newer verificationStatus
// column for the admin verifications queue.
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query;
  const where: Record<string, unknown> = { role: 'Client' };
  if (status === 'verified') where.isVerified = true;
  else if (status === 'unverified') where.verificationDocUrl = null;
  else if (status === 'under_review' || status === 'pending') {
    where.AND = [{ verificationDocUrl: { not: null } }, { isVerified: false }];
  } else if (status === 'rejected') where.verificationStatus = 'REJECTED';

  const companies = await prisma.user.findMany({
    where,
    select: companySelect,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: companies });
});

async function setVerified(req: Request, res: Response, isVerified: boolean, action: string) {
  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, email: true, companyName: true, aiTrialEndsAt: true },
  });
  if (!existing || existing.role !== 'Client') {
    return res.status(404).json({ message: 'Business account not found.' });
  }
  // First-time verification starts the AI Agents Suite's 7-day trial —
  // idempotent (a later re-verify never resets/extends it) and never
  // touched on an unverify, so toggling verification off and back on
  // doesn't hand out a second trial.
  const data: {
    isVerified: boolean;
    verificationStatus: 'APPROVED' | 'UNVERIFIED';
    verificationLevel?: 'BUSINESS';
    aiTrialEndsAt?: Date;
    trialStartDate?: Date;
  } = {
    isVerified,
    verificationStatus: isVerified ? 'APPROVED' : 'UNVERIFIED',
  };
  // Only set on a genuine verify — an unverify leaves the level as-is
  // (still BUSINESS, just no longer approved), never resets it to NONE.
  if (isVerified) data.verificationLevel = 'BUSINESS';
  const isFirstTrialGrant = isVerified && !existing.aiTrialEndsAt;
  if (isFirstTrialGrant) {
    data.trialStartDate = new Date();
    data.aiTrialEndsAt = new Date(Date.now() + AI_TRIAL_DAYS_ON_FIRST_VERIFY * 24 * 60 * 60 * 1000);
  }
  const user = await prisma.user.update({ where: { id: existing.id }, data, select: companySelect });
  await logAdminAction({ action, targetType: 'User', targetId: user.id, performedById: req.user!.id });
  if (isVerified) {
    // Best-effort — a delivery failure shouldn't undo the verification
    // that already committed above.
    sendBusinessVerifiedEmail(existing.email, existing.companyName ?? '').catch((err) =>
      console.error('[adminCompanies] sendBusinessVerifiedEmail failed:', err instanceof Error ? err.message : err)
    );
    prisma.notification
      .create({
        data: {
          userId: user.id,
          title: 'თქვენი ბიზნეს ანგარიში დადასტურდა',
          message: 'ადმინისტრაციამ დაადასტურა თქვენი ბიზნეს დოკუმენტი — Buy/Sell წვდომა უკვე ხელმისაწვდომია.',
          type: 'BUSINESS_KYC',
        },
      })
      .catch((err) => console.error('[adminCompanies] verify notification failed:', err));
  }
  res.json({ data: user });
}

router.post('/:id/verify', (req: Request, res: Response) => setVerified(req, res, true, 'company.verify'));
router.post('/:id/unverify', (req: Request, res: Response) => setVerified(req, res, false, 'company.unverify'));

// Distinct from unverify: rejection is a terminal state shown back to the
// business (verificationStatus REJECTED) with a required reason — sent to
// them by email and in-app, and invites a resubmission — whereas unverify
// is an admin-initiated toggle-off with no such messaging. Doesn't touch
// isVerified (already false for anything reject-able) or the trial.
router.post('/:id/reject', async (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) {
    return res.status(400).json({ message: 'A rejection reason is required.' });
  }
  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, role: true, email: true, companyName: true },
  });
  if (!existing || existing.role !== 'Client') {
    return res.status(404).json({ message: 'Business account not found.' });
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { verificationStatus: 'REJECTED', businessKycRejectionReason: reason },
    select: companySelect,
  });
  await logAdminAction({ action: 'company.reject', targetType: 'User', targetId: user.id, performedById: req.user!.id });

  // Best-effort, same reasoning as the verify path above — a delivery
  // failure shouldn't undo the rejection that already committed.
  sendBusinessRejectedEmail(existing.email, existing.companyName ?? '', reason).catch((err) =>
    console.error('[adminCompanies] sendBusinessRejectedEmail failed:', err instanceof Error ? err.message : err)
  );
  prisma.notification
    .create({
      data: {
        userId: user.id,
        title: 'თქვენი ბიზნეს დოკუმენტი უარყოფილია',
        message: reason,
        type: 'BUSINESS_KYC',
      },
    })
    .catch((err) => console.error('[adminCompanies] reject notification failed:', err));

  res.json({ data: user });
});

export default router;
