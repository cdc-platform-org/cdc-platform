import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

// ============================================================
// INDIVIDUAL IDENTITY VERIFICATION — admin review queue for the ID card/
// passport uploads from POST /auth/me/individual-verification-doc. The
// BUSINESS counterpart (Public Registry Extract review) already has its
// own file, routes/adminCompanies.ts — deliberately not merged into it:
// that file is hard-scoped to role: 'Client' rows throughout ("Business
// account not found" 404s, company-specific select shape), which doesn't
// fit an individual submitter of any role.
// ============================================================

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const individualSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  nationalId: true,
  verificationDocUrl: true,
  verificationLevel: true,
  verificationStatus: true,
  createdAt: true,
};

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const users = await prisma.user.findMany({
    where: { verificationLevel: 'INDIVIDUAL', ...(status ? { verificationStatus: status as any } : {}) },
    select: individualSelect,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: users });
});

// Approving here never touches isVerifiedGraduate — see auth.ts's own
// comment on the individual-verification-doc route for why the two stay
// independent. Downstream freelancer-rights gates read
// `verificationLevel === 'INDIVIDUAL' && verificationStatus === 'APPROVED'`
// as an OR-alternative to isVerifiedGraduate, not a replacement for it.
router.post('/:id/approve', async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, verificationLevel: true } });
  if (!existing || existing.verificationLevel !== 'INDIVIDUAL') {
    return res.status(404).json({ message: 'Individual verification submission not found.' });
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { verificationStatus: 'APPROVED' },
    select: individualSelect,
  });
  await logAdminAction({ action: 'individual-verification.approve', targetType: 'User', targetId: user.id, performedById: req.user!.id });
  prisma.notification
    .create({
      data: {
        userId: user.id,
        title: 'ვერიფიკაცია დადასტურებულია! 🎉',
        message: 'თქვენი პირადობის ვერიფიკაცია დადასტურდა — ფრილანსერის სტატუსი და ვაკანსიებზე განაცხადის შესაძლებლობა უკვე ხელმისაწვდომია.',
        type: 'INDIVIDUAL_VERIFICATION',
      },
    })
    .catch((err) => console.error('[adminVerifications] approve notification failed:', err));
  res.json({ data: user });
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ message: 'A rejection reason is required.' });

  const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, verificationLevel: true } });
  if (!existing || existing.verificationLevel !== 'INDIVIDUAL') {
    return res.status(404).json({ message: 'Individual verification submission not found.' });
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { verificationStatus: 'REJECTED', businessKycRejectionReason: reason },
    select: individualSelect,
  });
  await logAdminAction({ action: 'individual-verification.reject', targetType: 'User', targetId: user.id, performedById: req.user!.id });
  prisma.notification
    .create({
      data: {
        userId: user.id,
        title: 'ვერიფიკაცია უარყოფილია',
        message: `თქვენი პირადობის ვერიფიკაცია უარყოფილია: ${reason}`,
        type: 'INDIVIDUAL_VERIFICATION',
      },
    })
    .catch((err) => console.error('[adminVerifications] reject notification failed:', err));
  res.json({ data: user });
});

export default router;
