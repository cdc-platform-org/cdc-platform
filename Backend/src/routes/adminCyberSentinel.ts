import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Just a list — no status/review workflow (see the schema comment on
// CyberSentinelWaitlistEntry), this is launch-day outreach data, not a
// queue an admin works through one at a time.
router.get('/waitlist', async (_req: Request, res: Response) => {
  const entries = await prisma.cyberSentinelWaitlistEntry.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: entries });
});

export default router;
