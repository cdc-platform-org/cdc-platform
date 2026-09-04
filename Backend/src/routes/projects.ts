import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Public showcase — PUBLISHED only, newest event first. No pagination yet
// (same posture as success-stories/studio-cases at this content volume).
router.get('/', async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { date: 'desc' },
  });
  res.json({ data: projects });
});

router.get('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, status: 'PUBLISHED' } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  res.json({ data: project });
});

export default router;
