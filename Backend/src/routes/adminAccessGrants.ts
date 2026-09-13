import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { accessGrantSchema, accessGrantResourceType } from '../schemas/iakoSchemas';
import { createAccessGrant, listAccessGrants, revokeAccessGrant, AccessGrantError } from '../services/accessGrantService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  const resourceType = accessGrantResourceType.safeParse(req.query.resourceType);
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : undefined;
  res.json({ data: await listAccessGrants(resourceType.success ? resourceType.data : undefined, resourceId) });
});

router.post('/', async (req: Request, res: Response) => {
  const result = accessGrantSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const grant = await createAccessGrant({ ...result.data, createdById: req.user!.id });
    await logAdminAction({ action: 'ACCESS_GRANT_CREATED', targetType: 'ACCESS_GRANT', targetId: grant.id, performedById: req.user!.id, metadata: { resourceType: grant.resourceType, resourceId: grant.resourceId } });
    res.status(201).json({ data: grant });
  } catch (err) {
    if (err instanceof AccessGrantError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/:id/revoke', async (req: Request, res: Response) => {
  try {
    const grant = await revokeAccessGrant(req.params.id);
    await logAdminAction({ action: 'ACCESS_GRANT_REVOKED', targetType: 'ACCESS_GRANT', targetId: grant.id, performedById: req.user!.id });
    res.json({ data: grant });
  } catch (err) {
    if (err instanceof AccessGrantError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
