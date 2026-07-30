import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Public — mounted at /api/studio/cases (see server.ts), consumed by the
// /cases portfolio showcase, the case detail page, and the homepage's
// "Featured Case Studies" block. Distinct from /api/studio (StudioInquiry
// inbound leads) — this is outbound portfolio content.
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { featured } = req.query;
  const cases = await prisma.studioCaseStudy.findMany({
    where: featured === 'true' ? { isFeatured: true } : undefined,
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ data: cases });
});

router.get('/:slug', async (req: Request, res: Response) => {
  const caseStudy = await prisma.studioCaseStudy.findUnique({ where: { slug: req.params.slug } });
  if (!caseStudy) return res.status(404).json({ message: 'Case study not found.' });
  res.json({ data: caseStudy });
});

export default router;
