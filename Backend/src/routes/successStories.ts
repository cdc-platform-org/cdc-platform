import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Public — mounted at /api/v1/success-stories (see server.ts), consumed by
// the homepage and course detail pages' testimonial carousel.
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { featured } = req.query;
  const stories = await prisma.successStory.findMany({
    where: featured === 'true' ? { isFeatured: true } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: stories });
});

router.get('/:slug', async (req: Request, res: Response) => {
  const story = await prisma.successStory.findUnique({ where: { slug: req.params.slug } });
  if (!story) return res.status(404).json({ message: 'Success story not found.' });
  res.json({ data: story });
});

export default router;
