import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Public — mounted at /api/team (see server.ts), consumed by the homepage
// "ჩვენი გუნდი" block. Returns every active team member (both MANAGEMENT and
// TRAINER); pass ?type=MANAGEMENT or ?type=TRAINER to narrow it.
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { type } = req.query;
  const members = await prisma.teamMember.findMany({
    where: {
      active: true,
      ...(type === 'MANAGEMENT' || type === 'TRAINER' ? { type } : {}),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ data: members });
});

export default router;
