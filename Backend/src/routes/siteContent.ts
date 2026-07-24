import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Public — every page-content lookup the frontend does to render a page.
router.get('/:page', async (req: Request, res: Response) => {
  const row = await prisma.siteContent.findUnique({ where: { page: req.params.page } });
  res.json({ data: row ? { page: row.page, content: row.content, updatedAt: row.updatedAt } : null });
});

export default router;
