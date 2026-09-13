import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { manualEnrollmentSchema, createInviteSchema } from '../schemas/iakoSchemas';
import { createInvite, listInvites, revokeInvite, rotateInvite, listInviteRequests, reviewInviteRequest, LiveTrainingInviteError } from '../services/liveTrainingInviteService';
import { logAdminAction } from '../services/auditLogService';

// Same "each caller declares its own copy" convention as
// services/emailService.ts's FRONTEND_URL — see that file's many identical
// declarations.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

const router = Router();
router.use('/:trainingId', authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.trainingId }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Training not found.' });
  next();
});

router.get('/:trainingId/enrollments', async (req: Request, res: Response) => {
  const enrollments = await prisma.liveTrainingEnrollment.findMany({
    where: { liveTrainingId: req.params.trainingId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json({ data: enrollments });
});

// Deliberately no payment gate — this is an explicit admin override for
// comping a seat or reconciling a payment collected outside the platform
// (e.g. bank transfer), same "an admin's own action is trusted, unlike a
// learner-facing shortcut" posture as the QR invite path's payment guard
// (see liveTrainingInviteService.ts) being the thing that must NEVER be
// bypassable — this route can already bypass it by design, on purpose.
router.post('/:trainingId/enrollments', async (req: Request, res: Response) => {
  const result = manualEnrollmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = 'userId' in result.data
    ? await prisma.user.findUnique({ where: { id: result.data.userId } })
    : await prisma.user.findUnique({ where: { email: result.data.email } });
  if (!user) return res.status(404).json({ message: 'No user found with that account.' });

  const enrollment = await prisma.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: req.params.trainingId } },
    create: { userId: user.id, liveTrainingId: req.params.trainingId },
    update: { status: 'ACTIVE', enrolledAt: new Date(), completedAt: null },
  });
  await logAdminAction({ action: 'LIVE_TRAINING_MANUAL_ENROLLMENT', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { userId: user.id } });
  res.status(201).json({ data: enrollment });
});

router.delete('/:trainingId/enrollments/:userId', async (req: Request, res: Response) => {
  const { count } = await prisma.liveTrainingEnrollment.updateMany({
    where: { liveTrainingId: req.params.trainingId, userId: req.params.userId, status: { not: 'CANCELLED' } },
    data: { status: 'CANCELLED' },
  });
  if (!count) return res.status(404).json({ message: 'Active enrollment not found.' });
  await logAdminAction({ action: 'LIVE_TRAINING_ENROLLMENT_CANCELLED', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { userId: req.params.userId } });
  res.json({ data: { saved: true } });
});

router.get('/:trainingId/invites', async (req: Request, res: Response) => {
  res.json({ data: await listInvites(req.params.trainingId) });
});

router.post('/:trainingId/invites', async (req: Request, res: Response) => {
  const result = createInviteSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const invite = await createInvite(req.params.trainingId, result.data, req.user!.id);
    await logAdminAction({ action: 'LIVE_TRAINING_INVITE_CREATED', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { inviteId: invite.id } });
    res.status(201).json({ data: invite });
  } catch (err) {
    if (err instanceof LiveTrainingInviteError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.get('/:trainingId/invites/:id/qr', async (req: Request, res: Response) => {
  const invite = await prisma.liveTrainingInvite.findFirst({ where: { id: req.params.id, liveTrainingId: req.params.trainingId } });
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  const url = `${FRONTEND_URL}/live-trainings/invite/${invite.token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 512 });
  res.json({ data: { url, qrDataUrl } });
});

router.post('/:trainingId/invites/:id/revoke', async (req: Request, res: Response) => {
  try {
    const invite = await revokeInvite(req.params.id);
    await logAdminAction({ action: 'LIVE_TRAINING_INVITE_REVOKED', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { inviteId: invite.id } });
    res.json({ data: invite });
  } catch (err) {
    if (err instanceof LiveTrainingInviteError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/:trainingId/invites/:id/rotate', async (req: Request, res: Response) => {
  const existing = await prisma.liveTrainingInvite.findFirst({ where: { id: req.params.id, liveTrainingId: req.params.trainingId } });
  if (!existing) return res.status(404).json({ message: 'Invite not found.' });
  const invite = await rotateInvite(req.params.id);
  await logAdminAction({ action: 'LIVE_TRAINING_INVITE_ROTATED', targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { inviteId: invite.id } });
  res.json({ data: invite });
});

router.get('/:trainingId/invites/:id/requests', async (req: Request, res: Response) => {
  const invite = await prisma.liveTrainingInvite.findFirst({ where: { id: req.params.id, liveTrainingId: req.params.trainingId } });
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  res.json({ data: await listInviteRequests(invite.id) });
});

router.post('/:trainingId/invites/:id/requests/:userId/:decision', async (req: Request, res: Response) => {
  if (req.params.decision !== 'approve' && req.params.decision !== 'reject') return res.status(404).json({ message: 'Unknown action.' });
  const invite = await prisma.liveTrainingInvite.findFirst({ where: { id: req.params.id, liveTrainingId: req.params.trainingId } });
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  try {
    await reviewInviteRequest(invite.id, req.params.userId, req.params.decision as 'approve' | 'reject');
    await logAdminAction({
      action: req.params.decision === 'approve' ? 'LIVE_TRAINING_INVITE_REQUEST_APPROVED' : 'LIVE_TRAINING_INVITE_REQUEST_REJECTED',
      targetType: 'LIVE_TRAINING', targetId: req.params.trainingId, performedById: req.user!.id, metadata: { inviteId: invite.id, userId: req.params.userId },
    });
    res.json({ data: { saved: true } });
  } catch (err) {
    if (err instanceof LiveTrainingInviteError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
