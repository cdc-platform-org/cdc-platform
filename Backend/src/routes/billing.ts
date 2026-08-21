import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireNotBannedOrDeleted } from '../middleware/auth';
import {
  addPaymentMethodSchema,
  removePaymentMethodSchema,
  startTrialSchema,
  autoRenewSchema,
  cancelSubscriptionSchema,
} from '../schemas/billingSchemas';
import {
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  startTrialSubscription,
  setAutoRenew,
  cancelSubscription,
  listMySubscriptions,
  getCurrentCycleUsageTetri,
  getBillingSettings,
  BillingError,
} from '../services/billingService';
import { PaymentGatewayError } from '../services/paymentGatewayService';
import { getOrCreateStripeCustomerId, createStripeCardSetupIntent, StripeNotConfiguredError } from '../services/stripePaymentService';

const router = Router();

function respondBillingError(res: Response, err: unknown): boolean {
  if (err instanceof BillingError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return true;
  }
  if (err instanceof PaymentGatewayError) {
    res.status(400).json({ message: err.message });
    return true;
  }
  return false;
}

// ============================================================
// PAYMENT METHODS
// ============================================================

// Step 1 of adding a card: mint a SetupIntent client secret for this user's
// Stripe Customer (created on first use). The frontend confirms it
// client-side with Stripe.js/Elements — raw card data never reaches this
// server — then POSTs the resulting PaymentMethod id to POST
// /payment-methods below, which is what actually saves it.
router.post('/setup-intent', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, name: true } });
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  try {
    const customerId = await getOrCreateStripeCustomerId(req.user!.id, user.email, user.name);
    const clientSecret = await createStripeCardSetupIntent(customerId);
    res.json({ data: { clientSecret } });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return res.status(503).json({ message: err.message });
    throw err;
  }
});

router.get('/payment-methods', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const methods = await prisma.paymentMethod.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(methods);
});

router.post('/payment-methods', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = addPaymentMethodSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const method = await addPaymentMethod(req.user!.id, result.data, { setDefault: result.data.setDefault });
    res.status(201).json(method);
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

// "Swapping" the active card — makes an existing card the default going
// forward for new trials/renewals. Does not touch already-running
// subscriptions' paymentMethodId (those keep billing to whatever card they
// started on until explicitly changed).
router.patch('/payment-methods/:id/default', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  try {
    const method = await setDefaultPaymentMethod(req.user!.id, req.params.id);
    res.json(method);
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

router.delete('/payment-methods/:id', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = removePaymentMethodSchema.safeParse(req.body ?? {});
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    await removePaymentMethod(req.user!.id, req.params.id, result.data);
    res.status(204).send();
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

// ============================================================
// SUBSCRIPTIONS
// ============================================================

router.get('/subscriptions', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const subscriptions = await listMySubscriptions(req.user!.id);
  const withUsage = await Promise.all(
    subscriptions.map(async (sub) => ({
      ...sub,
      currentCycleUsageTetri: await getCurrentCycleUsageTetri(sub.id),
    }))
  );
  res.json({ data: withUsage });
});

router.post('/subscriptions/trial', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = startTrialSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const subscription = await startTrialSubscription(req.user!.id, result.data.productType, result.data.referenceId);
    res.status(201).json(subscription);
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

router.patch('/subscriptions/:id/auto-renew', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = autoRenewSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const subscription = await setAutoRenew(req.user!.id, req.params.id, result.data.autoRenew);
    res.json(subscription);
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

router.post('/subscriptions/:id/cancel', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = cancelSubscriptionSchema.safeParse(req.body ?? {});
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const subscription = await cancelSubscription(req.user!.id, req.params.id, result.data.reason);
    res.json(subscription);
  } catch (err) {
    if (respondBillingError(res, err)) return;
    throw err;
  }
});

// Read-only pricing knobs — safe to expose to any authenticated user so the
// frontend can render "10-Day Free Trial", "99 GEL/month", etc. without
// hardcoding numbers that only the admin-only PUT (routes/adminFinance.ts)
// can change.
router.get('/settings', authenticate, async (_req: Request, res: Response) => {
  const settings = await getBillingSettings();
  res.json({ data: settings });
});

export default router;
