import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

// Platform-wide, cross-business view of AI-proctored exam submissions (the
// "candidate verification" surface businesses see per-session in their own
// dashboard's ExamProctoringTab, here rolled up across every business for
// ops monitoring — same "headline list, dedicated page" split as
// adminDisputes.ts/adminPayouts.ts). Read-only: no admin action changes an
// ExamSubmission, so unlike those two there is nothing to audit-log here.
const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const businessSelect = { select: { id: true, name: true, email: true } };

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const [submissions, counts] = await Promise.all([
    prisma.examSubmission.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        examSession: { select: { id: true, title: true, topic: true, business: businessSelect } },
      },
      orderBy: { startedAt: 'desc' },
      // Recent-first cap, not a paginated ledger — same posture as
      // adminDisputes.ts's unbounded-but-filtered list; exam proctoring
      // volume is expected to stay well under this for the pilot.
      take: 200,
    }),
    prisma.examSubmission.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  res.json({
    data: submissions,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
});

export default router;
