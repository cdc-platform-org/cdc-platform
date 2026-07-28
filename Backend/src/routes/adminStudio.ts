import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { updateStudioInquirySchema } from '../schemas/studioSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const inquiries = await prisma.studioInquiry.findMany({
    where: status ? { status: status as any } : undefined,
    include: { reviewedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: inquiries });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const result = updateStudioInquirySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const existing = await prisma.studioInquiry.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Inquiry not found.' });

  const isResolving = result.data.status && result.data.status !== 'PENDING' && result.data.status !== 'IN_REVIEW';
  const inquiry = await prisma.studioInquiry.update({
    where: { id: req.params.id },
    data: {
      ...result.data,
      reviewedById: result.data.status ? req.user!.id : undefined,
      resolvedAt: isResolving ? new Date() : result.data.status ? null : undefined,
    },
  });

  await logAdminAction({
    action: 'studio.inquiry.update',
    targetType: 'StudioInquiry',
    targetId: inquiry.id,
    performedById: req.user!.id,
    metadata: { status: inquiry.status },
  });
  res.json({ data: inquiry });
});

export default router;
