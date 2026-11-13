/**
 * BOG (Bank of Georgia) payments API, mounted at /api/payments.
 * Stripe lives separately in routes/stripePayments.ts.
 *
 * Each file in this folder is a small router for one kind of checkout;
 * shared helpers are in shared.ts. Route order below matches the original
 * single-file router.
 */
import { Router } from 'express';
import learningCheckoutRoutes from './learningCheckout';
import subscriptionCheckoutRoutes from './subscriptionCheckout';
import mentorshipCheckoutRoutes from './mentorshipCheckout';
import marketplaceCheckoutRoutes from './marketplaceCheckout';
import childrensBookCheckoutRoutes from './childrensBookCheckout';
import giftCardCheckoutRoutes from './giftCardCheckout';
import bogCallbackRoutes from './bogCallback';
import paymentHistoryRoutes from './paymentHistory';

const router = Router();

router.use(learningCheckoutRoutes);
router.use(subscriptionCheckoutRoutes);
router.use(mentorshipCheckoutRoutes);
router.use(marketplaceCheckoutRoutes);
router.use(childrensBookCheckoutRoutes);
router.use(giftCardCheckoutRoutes);
router.use(bogCallbackRoutes);
router.use(paymentHistoryRoutes);

export { applyBogPaymentResult } from './bogCallback';

export default router;
