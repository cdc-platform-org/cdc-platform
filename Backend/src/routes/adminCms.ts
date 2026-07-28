import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { extractBunnyStorageUrls, deleteBunnyStorageUrlIfManaged } from '../services/bunnyStorage';

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

  // CMS content is unstructured JSON (each page owns its own shape), so
  // there's no page-specific "old imageUrl" field to compare — instead,
  // diff every Bunny-managed URL found anywhere in the old content against
  // the new content and clean up whatever dropped out (a replaced
  // heksCard.imageUrl, a removed gallery image, etc).
  const previous = await prisma.siteContent.findUnique({ where: { page: req.params.page }, select: { content: true } });

  const row = await prisma.siteContent.upsert({
    where: { page: req.params.page },
    update: { content: result.data.content, updatedById: req.user!.id },
    create: { page: req.params.page, content: result.data.content, updatedById: req.user!.id },
  });

  if (previous) {
    const oldUrls = extractBunnyStorageUrls(previous.content);
    const newUrls = extractBunnyStorageUrls(result.data.content);
    for (const url of oldUrls) {
      if (!newUrls.has(url)) {
        // Fire-and-forget — the response shouldn't wait on Bunny, and a
        // failed cleanup just leaves harmless orphaned storage debris.
        deleteBunnyStorageUrlIfManaged(url).catch(() => {});
      }
    }
  }

  await logAdminAction({
    action: 'cms.page.update',
    targetType: 'SiteContent',
    targetId: row.page,
    performedById: req.user!.id,
  });
  res.json({ data: { page: row.page, content: row.content, updatedAt: row.updatedAt } });
});

export default router;
