import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

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
  aiTrialEndsAt: true,
  aiSubscriptionActive: true,
  createdAt: true,
};

const AI_TRIAL_DAYS_ON_FIRST_VERIFY = 7;

// Every Client (Business) account — the frontend derives the three-state
// badge (Unverified / Under Review / Verified) from verificationDocUrl +
// isVerified, same as the dashboard does for its own account.
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query;
  const where: Record<string, unknown> = { role: 'Client' };
  if (status === 'verified') where.isVerified = true;
  else if (status === 'unverified') where.verificationDocUrl = null;
  else if (status === 'under_review') where.AND = [{ verificationDocUrl: { not: null } }, { isVerified: false }];

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
    select: { id: true, role: true, aiTrialEndsAt: true },
  });
  if (!existing || existing.role !== 'Client') {
    return res.status(404).json({ message: 'Business account not found.' });
  }
  // First-time verification starts the AI Agents Suite's 7-day trial —
  // idempotent (a later re-verify never resets/extends it) and never
  // touched on an unverify, so toggling verification off and back on
  // doesn't hand out a second trial.
  const data: { isVerified: boolean; aiTrialEndsAt?: Date } = { isVerified };
  if (isVerified && !existing.aiTrialEndsAt) {
    data.aiTrialEndsAt = new Date(Date.now() + AI_TRIAL_DAYS_ON_FIRST_VERIFY * 24 * 60 * 60 * 1000);
  }
  const user = await prisma.user.update({ where: { id: existing.id }, data, select: companySelect });
  await logAdminAction({ action, targetType: 'User', targetId: user.id, performedById: req.user!.id });
  res.json({ data: user });
}

router.post('/:id/verify', (req: Request, res: Response) => setVerified(req, res, true, 'company.verify'));
router.post('/:id/unverify', (req: Request, res: Response) => setVerified(req, res, false, 'company.unverify'));

export default router;
