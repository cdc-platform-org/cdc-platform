import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { digitalToolLinkedProductId, isDigitalToolKey } from '../config/digitalTools';
import { hasAccessGrant } from './accessGrantService';

// Entitlement to a Digital Tool comes from either of two independent
// sources — a completed purchase of the tool's linked DigitalProduct (the
// same ProductPurchase.paymentStatus === 'COMPLETED' check routes/products.ts
// uses to compute `purchased`), or an admin-issued AccessGrant (checked by
// both userId and email, since a grant can be issued before the person
// even registers — see AccessGrant.email's schema comment). Neither
// existed before this feature: every /dashboard/tools/* page and its
// backing route were reachable by any authenticated user regardless of
// purchase — this is the first real entitlement gate for them.
export async function hasDigitalToolAccess(userId: string, email: string, toolKey: string): Promise<boolean> {
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
