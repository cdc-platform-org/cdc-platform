import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getEffectiveFeeSchedule } from '../services/platformFeeScheduleService';

const router = Router();

// Read-only, any authenticated user — powers live commission-rate display
// in ProposalModal.tsx's fee calculator and the Digital Store submission
// form's commission banner, so those never drift from what
// escrowService.ts/productSaleService.ts actually charge at capture time.
// Deliberately separate from /admin/commissions (SUPER_ADMIN-only,
// read+write) rather than reusing it — this is a narrower, public-to-any-
// user read.
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const feeSchedule = await getEffectiveFeeSchedule();
  res.json({ data: { feeSchedule } });
});

export default router;
