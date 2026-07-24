import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const updateContentSchema = z.object({
  // Deliberately unstructured — each page owns its own content shape (see
  // Frontend/src/types/siteContent.ts). Just needs to be a JSON object.
  content: z.record(z.string(), z.any()),
});

router.get('/:page', async (req: Request, res: Response) => {
  const row = await prisma.siteContent.findUnique({ where: { page: req.params.page } });
  res.json({ data: row ? { page: row.page, content: row.content, updatedAt: row.updatedAt } : null });
});

router.put('/:page', async (req: Request, res: Response) => {
  const result = updateContentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const row = await prisma.siteContent.upsert({
    where: { page: req.params.page },
    update: { content: result.data.content, updatedById: req.user!.id },
    create: { page: req.params.page, content: result.data.content, updatedById: req.user!.id },
  });

  await logAdminAction({
    action: 'cms.page.update',
    targetType: 'SiteContent',
    targetId: row.page,
    performedById: req.user!.id,
  });
  res.json({ data: { page: row.page, content: row.content, updatedAt: row.updatedAt } });
});

export default router;
