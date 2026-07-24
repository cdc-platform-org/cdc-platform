import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { rejectUserSchema, banUserSchema } from '../schemas/adminSchemas';
const router = Router();

// Baseline: any admin-team member can at least read. Mutating routes below
// layer a stricter requireAdminRole() on top where the task calls for it.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

router.get('/users', async (req: Request, res: Response) => {
  const { status } = req.query;
  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
  if (status && !validStatuses.includes(String(status))) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }
  const users = await prisma.user.findMany({
    where: status ? { status: status as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' } : undefined,
    orderBy: { createdAt: 'desc' },
    omit: { password: true },
  });
  res.json(users);
});

router.post('/users/:id/approve', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.status === 'APPROVED') {
    return res.status(400).json({ message: 'This user is already approved.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', rejectionReason: null },
    omit: { password: true },
  });
  res.json(updated);
});

router.post('/users/:id/reject', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = rejectUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.status === 'REJECTED') {
    return res.status(400).json({ message: 'This user is already rejected.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', rejectionReason: result.data.reason ?? null },
    omit: { password: true },
  });
  res.json(updated);
});

router.post(
  '/users/:id/verify-graduate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role !== 'Student') {
      return res.status(400).json({ message: 'Only students can be verified as CDC graduates.' });
    }
    if (user.isVerifiedGraduate) {
      return res.status(400).json({ message: 'This user is already a verified graduate.' });
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerifiedGraduate: true },
      omit: { password: true },
    });
    res.json(updated);
  }
);

router.post(
  '/users/:id/unverify-graduate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerifiedGraduate: false },
      omit: { password: true },
    });
    res.json(updated);
  }
);

// Ban/unban: available to all three admin tiers (this is the "Support/Report
// Management" domain MODERATOR is meant to cover), but a non-SUPER_ADMIN
// can't ban a fellow admin-team member — only SUPER_ADMIN can act on staff.
router.post('/users/:id/ban', async (req: Request, res: Response) => {
  const result = banUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.id === req.user!.id) {
    return res.status(400).json({ message: 'You cannot ban your own account.' });
  }
  if (user.adminRole && req.adminRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only a SuperAdmin can ban an admin-team member.' });
  }
  if (user.isBanned) {
    return res.status(400).json({ message: 'This user is already banned.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: true, bannedAt: new Date(), banReason: result.data.reason ?? null },
    omit: { password: true },
  });
  res.json(updated);
});

router.post('/users/:id/unban', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!user.isBanned) {
    return res.status(400).json({ message: 'This user is not banned.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: false, bannedAt: null, banReason: null },
    omit: { password: true },
  });
  res.json(updated);
});

export default router;
