import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Public — mounted at /api/trainers (see server.ts), consumed by the
// dedicated /trainers page. Active TeamMember rows of type TRAINER only.
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const trainers = await prisma.teamMember.findMany({
    where: { active: true, type: 'TRAINER' },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ data: trainers });
});

export default router;
