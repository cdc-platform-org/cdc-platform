import * as Sentry from '@sentry/node';
import { prisma } from '../lib/prisma';
import { getBogOrderDetails } from './bogPaymentService';
import { getStripeCheckoutSession } from './stripePaymentService';
// Reused from the route modules rather than re-implemented here — these are
// the exact same fulfillment functions the BOG callback / Stripe webhook /
// each gateway's own /status poll route already rely on (course enrollment,
// escrow capture, calendar sync, emails, etc. all live inside them). Calling
// them from this sweep instead of duplicating that logic is what makes a
// reconciled payment behave identically to one that completed the normal
// callback/webhook way.
import { applyBogPaymentResult } from '../routes/payments';
import { applyStripePaymentResult, markStripeCheckoutExpired } from '../routes/stripePayments';

// A user who closes their tab mid-checkout leaves no callback/webhook to
// ever fire — nothing else in this codebase revisits a still-PENDING
// BogPayment/StripePayment on its own (each gateway's /status poll route
// only reconciles when the *frontend* asks, which never happens if the user
// never comes back). 30 minutes comfortably clears BOG's/Stripe's own
// checkout-session lifetimes plus the 15-minute PENDING_ORDER_REUSE_WINDOW_MS
// both checkout routes already use for a *fresh* retry, so this sweep only
// ever touches an order that's genuinely been abandoned.
const STALE_PENDING_MS = 30 * 60 * 1000;

// A 'pending-...' bogOrderId/stripeSessionId means createBogOrder/
// createStripeCheckoutSession never actually succeeded (or the immediately-
// following DB update never landed) — there is no real order/session on the
// gateway's side to query, so these are excluded rather than sent to
// getBogOrderDetails/getStripeCheckoutSession, which would just 404/error on
// every one of them.
function hasRealGatewayId(id: string, placeholderPrefix: string): boolean {
  return !id.startsWith(placeholderPrefix);
}

export interface ReconcilePendingPaymentsResult {
  bogCompletedIds: string[];
  bogFailedIds: string[];
  stripeCompletedIds: string[];
  stripeFailedIds: string[];
  errorIds: string[];
}

export async function reconcilePendingPayments(): Promise<ReconcilePendingPaymentsResult> {
  const cutoff = new Date(Date.now() - STALE_PENDING_MS);
  const result: ReconcilePendingPaymentsResult = {
    bogCompletedIds: [],
    bogFailedIds: [],
    stripeCompletedIds: [],
    stripeFailedIds: [],
    errorIds: [],
  };

  const staleBogPayments = await prisma.bogPayment.findMany({
    where: { status: 'PENDING', createdAt: { lte: cutoff } },
  });
  for (const payment of staleBogPayments) {
    if (!hasRealGatewayId(payment.bogOrderId, 'pending-')) continue;
    try {
      const details = await getBogOrderDetails(payment.bogOrderId);
      await applyBogPaymentResult(payment.id, details.order_status.key, { reconciledFrom: 'cron-sweep', details });
      const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (fresh.status === 'COMPLETED') result.bogCompletedIds.push(payment.id);
      else if (fresh.status === 'FAILED') result.bogFailedIds.push(payment.id);
      // Any other status (still 'created'/'processing'/etc. on BOG's side)
      // is left PENDING — a genuinely still-in-progress payment, not stuck.
    } catch (err) {
      console.error(`[payment-reconciliation] BOG payment ${payment.id} reconciliation failed:`, err);
      Sentry.captureException(err, { extra: { bogPaymentId: payment.id, bogOrderId: payment.bogOrderId } });
      result.errorIds.push(payment.id);
    }
  }

  const staleStripePayments = await prisma.stripePayment.findMany({
    where: { status: 'PENDING', createdAt: { lte: cutoff } },
  });
  for (const payment of staleStripePayments) {
    if (!hasRealGatewayId(payment.stripeSessionId, 'pending-')) continue;
    try {
      const session = await getStripeCheckoutSession(payment.stripeSessionId);
      if (session.status === 'complete' && session.payment_status === 'paid') {
        await applyStripePaymentResult(payment.id, session, { reconciledFrom: 'cron-sweep' });
        result.stripeCompletedIds.push(payment.id);
      } else if (session.status === 'expired') {
        await markStripeCheckoutExpired(payment.id, { reconciledFrom: 'cron-sweep' });
        result.stripeFailedIds.push(payment.id);
      }
      // session.status === 'open' — a real checkout the buyer just hasn't
      // finished yet (or Stripe hasn't expired it yet either); left PENDING.
    } catch (err) {
      console.error(`[payment-reconciliation] Stripe payment ${payment.id} reconciliation failed:`, err);
      Sentry.captureException(err, { extra: { stripePaymentId: payment.id, stripeSessionId: payment.stripeSessionId } });
      result.errorIds.push(payment.id);
    }
  }

  return result;
}
