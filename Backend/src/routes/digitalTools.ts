/**
 * Express router mounted at `/api/digital-tools` (see server.ts).
 * Endpoints:
 *   GET /:key/access
 */
import { AI_TOOL_MONTHLY_PRICE_MINOR, AI_TOOL_SUBSCRIPTION_DAYS, AI_TOOL_PAYMENT_NOTE, AI_SUBSCRIPTION_TOOLS } from '../config/aiToolSubscriptions';
import { prisma } from '../lib/prisma';
import { hasActiveCollegeAiAccess } from '../services/learning/collegeAiAccessService';
import { Router, Request, Response } from 'express';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { isDigitalToolKey } from '../config/digitalTools';
import { hasDigitalToolAccess } from '../services/marketplace/digitalToolAccessService';

const router = Router();
router.get('/catalog', (_req: Request, res: Response) => res.json({ data: AI_SUBSCRIPTION_TOOLS.map(key => ({ key, priceMinor: AI_TOOL_MONTHLY_PRICE_MINOR, periodDays: AI_TOOL_SUBSCRIPTION_DAYS })) }));

// A single, cheap probe the Frontend calls before rendering a gated tool
// page's full UI — the REAL enforcement is always the tool's own backend
// routes (see mediaStudio.ts's requireMediaStudioAccess); this exists so a
// denied visitor sees a clear "request access" state instead of a page that
// loads, then errors on its first real action.
router.get('/:key/access', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  if (!isDigitalToolKey(req.params.key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  const allowed = await hasDigitalToolAccess(req.user!.id, req.user!.email, req.params.key);
  const collegeAccess = await hasActiveCollegeAiAccess(req.user!.id);
  const subscription = await prisma.accessGrant.findFirst({ where: { userId: req.user!.id, resourceType: 'DIGITAL_TOOL', resourceId: req.params.key, revokedAt: null, note: { startsWith: AI_TOOL_PAYMENT_NOTE }, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' }, select: { expiresAt: true } });
  res.json({ data: { allowed, collegeAccess, subscriptionEndsAt: subscription?.expiresAt ?? null, priceMinor: AI_TOOL_MONTHLY_PRICE_MINOR, periodDays: AI_TOOL_SUBSCRIPTION_DAYS } });
});

export default router;
