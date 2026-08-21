import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { PlatformFeeServiceType } from '@prisma/client';
import { logAdminAction } from '../services/auditLogService';
import { getEffectiveFeeSchedule, upsertCommissionPercentage } from '../services/platformFeeScheduleService';
import { getDailyPostLimit, updateDailyPostLimit } from '../services/postingLimitService';
import { updateCommissionPercentageSchema, updateDailyPostLimitSchema } from '../schemas/platformCommissionSchemas';

const router = Router();
// Same RBAC posture as adminFinance.ts — commission rates and posting
// limits are financial/marketplace-economics knobs, SUPER_ADMIN only.
router.use(authenticate, requireAdminRole('SUPER_ADMIN'));

const VALID_SERVICE_TYPES = new Set<string>(Object.values(PlatformFeeServiceType));

router.get('/', async (_req: Request, res: Response) => {
  const [feeSchedule, dailyPostLimit] = await Promise.all([getEffectiveFeeSchedule(), getDailyPostLimit()]);
  res.json({ data: { feeSchedule, dailyPostLimit } });
});

router.put('/fee-schedule/:serviceType', async (req: Request, res: Response) => {
  const { serviceType } = req.params;
  if (!VALID_SERVICE_TYPES.has(serviceType)) {
    return res.status(400).json({ message: 'Unknown service type.' });
  }
  const result = updateCommissionPercentageSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const row = await upsertCommissionPercentage(
    serviceType as PlatformFeeServiceType,
    result.data.commissionPercentage,
    req.user!.email
  );

  await logAdminAction({
    action: 'commissions.fee-schedule.update',
    targetType: 'PlatformFeeSchedule',
    targetId: row.id,
    performedById: req.user!.id,
    metadata: { serviceType, commissionPercentage: result.data.commissionPercentage },
  });

  res.json({ data: row });
});

router.put('/daily-post-limit', async (req: Request, res: Response) => {
  const result = updateDailyPostLimitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const settings = await updateDailyPostLimit(result.data.dailyPostLimit, req.user!.email);

  await logAdminAction({
    action: 'commissions.daily-post-limit.update',
    targetType: 'PlatformSettings',
    targetId: settings.id,
    performedById: req.user!.id,
    metadata: { dailyPostLimit: result.data.dailyPostLimit },
  });

  res.json({ data: settings });
});

export default router;
