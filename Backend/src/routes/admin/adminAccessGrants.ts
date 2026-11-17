/**
 * Express router mounted at `/api/admin/access-grants` (see server.ts).
 * Endpoints:
 *   GET /
 *   POST /
 *   POST /:id/revoke
 *   GET /college-ai-access?email= — a student's free course-based AI tool access
 */
import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../../middleware/auth';
import { hideMoneyFromNonSuperAdmin } from '../../middleware/moneyVisibility';
import { accessGrantSchema, accessGrantResourceType } from '../../schemas/iakoSchemas';
import { createAccessGrant, listAccessGrants, revokeAccessGrant, AccessGrantError } from '../../services/account/accessGrantService';
import { logAdminAction } from '../../services/account/auditLogService';
import { prisma } from '../../lib/prisma';
import { getCollegeAiAccessStatus, COLLEGE_AI_ACCESS_DAYS } from '../../services/learning/collegeAiAccessService';

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'), hideMoneyFromNonSuperAdmin);

router.get('/', async (req: Request, res: Response) => {
  const resourceType = accessGrantResourceType.safeParse(req.query.resourceType);
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : undefined;
  res.json({ data: await listAccessGrants(resourceType.success ? resourceType.data : undefined, resourceId) });
});

// Lets an admin see whether a student currently gets the AI tools free
// through an unfinished paid course (collegeAiAccessService.ts) — that
// access is derived live and never stored, so it isn't in the grants list.
router.get('/college-ai-access', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ message: 'email is required.' });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, name: true, email: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const status = await getCollegeAiAccessStatus(user.id);
  res.json({ data: { user, ...status, windowDays: COLLEGE_AI_ACCESS_DAYS } });
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
