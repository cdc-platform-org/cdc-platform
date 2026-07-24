import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { createCategorySchema, moderateThreadSchema } from '../schemas/forumSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const authorSelect = { select: { id: true, name: true, email: true, role: true } };

// Pending posts requiring approval before going public.
router.get('/queue', async (_req: Request, res: Response) => {
  const threads = await prisma.forumThread.findMany({
    where: { moderationStatus: 'PENDING' },
    include: { author: authorSelect, category: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: threads });
});

router.post('/threads/:id/moderate', async (req: Request, res: Response) => {
  const result = moderateThreadSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const thread = await prisma.forumThread
    .update({
      where: { id: req.params.id },
      data: { moderationStatus: result.data.status, moderationReason: result.data.reason ?? null, moderatedAt: new Date() },
    })
    .catch(() => null);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });

  await logAdminAction({
    action: result.data.status === 'APPROVED' ? 'forum.thread.approve' : 'forum.thread.reject',
    targetType: 'ForumThread',
    targetId: thread.id,
    performedById: req.user!.id,
    metadata: { reason: result.data.reason },
  });
  res.json({ data: thread });
});

router.delete('/threads/:id', async (req: Request, res: Response) => {
  await prisma.forumThread.delete({ where: { id: req.params.id } }).catch(() => {});
  await logAdminAction({
    action: 'forum.thread.delete',
    targetType: 'ForumThread',
    targetId: req.params.id,
    performedById: req.user!.id,
  });
  res.status(204).send();
});

// ---- Categories (admin-managed) ----
router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.forumCategory.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ data: categories });
});

router.post('/categories', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = createCategorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const category = await prisma.forumCategory.create({ data: result.data });
    res.status(201).json({ data: category });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'A category with this slug already exists.' });
    throw err;
  }
});

router.delete('/categories/:id', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  await prisma.forumCategory.delete({ where: { id: req.params.id } }).catch(() => {});
  res.status(204).send();
});

export default router;
