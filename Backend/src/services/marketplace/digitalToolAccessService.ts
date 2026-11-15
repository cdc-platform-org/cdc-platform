import { getSubscriptionState } from '../payments/subscriptionStateService';
/**
 * Service (digital store & marketplace).
 * Exports: hasDigitalToolAccess, requireDigitalToolAccess.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { digitalToolLinkedProductId, isDigitalToolKey } from '../../config/digitalTools';
import { hasEducatorVipAccess } from '../../utils/educatorVipAccess';
import { hasEnglishTutorProAccess } from '../../utils/englishTutorAccess';
import { hasActiveCollegeAiAccess } from '../learning/collegeAiAccessService';
import { hasAccessGrant } from '../account/accessGrantService';

// An unfinished enrolled college course grants temporary access. Existing completed
// purchases and explicit admin grants remain independent access sources.
// The college check is live, so finishing the final exam removes only that benefit.
export async function hasDigitalToolAccess(userId: string, email: string, toolKey: string): Promise<boolean> {
  if (!isDigitalToolKey(toolKey)) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true, educatorVipActive: true, educatorVipTrialEndDate: true, educatorVipPaidUntil: true, tutorSubscriptionTier: true, tutorTrialEndDate: true, tutorSubscriptionPeriodEnd: true } });
  if (!user) return false;
  if (user.adminRole || user.role === 'SuperAdmin') return true;
  if (await hasActiveCollegeAiAccess(userId)) return true;
  if (toolKey === 'educator-hub' && hasEducatorVipAccess(user)) return true;
  if (toolKey === 'english-tutor' && hasEnglishTutorProAccess(user)) return true;
  if (toolKey === 'ai-agents' && (await getSubscriptionState(userId)).hasAccess) return true;
  if (toolKey === 'chatbot-builder' && await prisma.agent.findFirst({ where: { businessId: userId, status: { in: ['ACTIVE', 'PAUSED'] }, paidUntil: { gt: new Date() } }, select: { id: true } })) return true;
  if (toolKey === 'coloring-pages' && (await prisma.coloringAccount.findUnique({ where: { userId }, select: { balance: true } }))?.balance) return true;
  const linkedProductId = digitalToolLinkedProductId(toolKey);
  if (linkedProductId) {
    const purchase = await prisma.productPurchase.findUnique({
      where: { userId_productId: { userId, productId: linkedProductId } },
      select: { paymentStatus: true },
    });
    if (purchase?.paymentStatus === 'COMPLETED') return true;
  }
  return hasAccessGrant('DIGITAL_TOOL', toolKey, { userId, email });
}

// Express middleware for a Digital Tool's own backend routes — mount as
// router.use(authenticate, requireNotBannedOrDeleted, requireDigitalToolAccess('educator-hub')).
// An internal admin-team member (User.adminRole set — see requireAdminRole's
// own comment on why this is a DB lookup, not a JWT claim) always passes:
// managing/testing a tool shouldn't require also buying or being granted
// it, same "admins bypass their own gate" posture as
// requireTrainingGuideAccess's `admin` param.
export function requireDigitalToolAccess(toolKey: string) {
  if (!isDigitalToolKey(toolKey)) throw new Error(`Unknown Digital Tool key: ${toolKey}`);
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
    if (user?.adminRole) return next();
    const allowed = await hasDigitalToolAccess(req.user!.id, req.user!.email, toolKey);
    if (!allowed) return res.status(403).json({ message: 'You do not have access to this tool yet.' });
    next();
  };
}
