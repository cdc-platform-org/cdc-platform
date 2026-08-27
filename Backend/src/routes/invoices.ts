import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { generateInvoicePdf, InvoiceData } from '../services/invoiceService';
import { getCurrentCycleUsageTetri } from '../services/billingService';

const router = Router();
// requireNotBannedOrDeleted, not just authenticate: these routes hand back
// PDFs containing tax ID, national ID, email, and payment amounts — a
// banned/self-deleted user's still-valid JWT (up to 7 days old) must not
// keep working here just because nothing else in this file re-checked
// account standing (see requireNotBannedOrDeleted's own comment in
// middleware/auth.ts for why authenticate() alone isn't enough).
router.use(authenticate, requireNotBannedOrDeleted);

// CDC-INV-YYYY-XXXXXX — deterministic from the source record's own id, so
// re-downloading the same payment's invoice always yields the identical
// number (important for accounting). Not a true incrementing sequence (that
// would need a dedicated counter with its own concurrency handling) — a
// reasonable simplification for a first version, noted here rather than
// silently implied to be sequential.
function invoiceNumberFor(sourceId: string, date: Date): string {
  const year = date.getFullYear();
  const hash = crypto.createHash('sha256').update(sourceId).digest('hex').slice(0, 6).toUpperCase();
  return `INV-${year}-${hash}`;
}

function buyerTaxId(user: { taxId: string | null; nationalId: string | null }): string | null {
  return user.taxId || user.nationalId || null;
}

function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

const userInvoiceSelect = { select: { name: true, email: true, companyName: true, taxId: true, nationalId: true } };

// Shared by both gateway branches below — same purpose→description mapping,
// only the "how much of this went to a creator" breakdown differs (see
// includeCommissionBreakdown's own comment on the Stripe branch).
export async function describePurchase(
  purpose: string,
  referenceId: string,
  userId: string,
  includeCommissionBreakdown: boolean
): Promise<{ description: string; platformFee: number | null; netAmount: number | null }> {
  let description = 'CDC Platform purchase';
  let platformFee: number | null = null;
  let netAmount: number | null = null;

  if (purpose === 'COURSE') {
    const course = await prisma.course.findUnique({ where: { id: referenceId }, select: { title: true } });
    description = course ? `Course enrollment: ${course.title}` : 'Course enrollment';
  } else if (purpose === 'PRODUCT') {
    const product = await prisma.digitalProduct.findUnique({ where: { id: referenceId }, select: { title: true } });
    description = product ? `Digital Store purchase: ${product.title}` : 'Digital Store purchase';
    if (includeCommissionBreakdown) {
      // Only a real external creator's sale has a commission split at all —
      // admin-catalog products keep 100% with no split, see productSaleService.ts.
      const purchase = await prisma.productPurchase.findUnique({
        where: { userId_productId: { userId, productId: referenceId } },
        select: { commissionAmount: true, netAmount: true },
      });
      platformFee = purchase?.commissionAmount ?? null;
      netAmount = purchase?.netAmount ?? null;
    }
  } else if (purpose === 'MENTORSHIP') {
    const mentor = await prisma.user.findUnique({ where: { id: referenceId }, select: { name: true } });
    description = mentor ? `Mentorship session with ${mentor.name}` : 'Mentorship session';
  } else if (purpose === 'GIG_ESCROW_FUNDING') {
    const gig = await prisma.gig.findUnique({ where: { id: referenceId }, select: { title: true } });
    description = gig ? `Escrow funding: ${gig.title}` : 'Escrow funding';
  }
  return { description, platformFee, netAmount };
}

// Course / Digital Product / Mentorship / Gig-escrow-funding purchase
// invoice. One completed BogPayment (GEL, routes/payments.ts) or
// StripePayment (USD/EUR, routes/stripePayments.ts) is one completed
// checkout — the frontend's payment-history table merges both gateways
// into one list and sends every "Download Invoice" click here regardless
// of which one it was, so this route tries BogPayment first and falls back
// to StripePayment rather than 404ing every international buyer's invoice
// (the gap a pre-launch review flagged as still live).
router.get('/payment/:bogPaymentId/download', async (req: Request, res: Response) => {
  const bogPayment = await prisma.bogPayment.findUnique({
    where: { id: req.params.bogPaymentId },
    include: { user: userInvoiceSelect },
  });

  if (bogPayment) {
    const isOwner = bogPayment.userId === req.user!.id;
    const isAdmin = req.user!.role === 'SuperAdmin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You do not have access to this invoice.' });
    if (bogPayment.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'An invoice is only available for a completed payment.' });
    }

    const { description, platformFee, netAmount } = await describePurchase(
      bogPayment.purpose,
      bogPayment.referenceId,
      bogPayment.userId,
      true
    );
    const invoiceNumber = invoiceNumberFor(bogPayment.id, bogPayment.completedAt ?? bogPayment.createdAt);
    const data: InvoiceData = {
      invoiceNumber,
      issueDate: bogPayment.completedAt ?? bogPayment.createdAt,
      buyerName: bogPayment.user.companyName || bogPayment.user.name,
      buyerEmail: bogPayment.user.email,
      buyerTaxId: buyerTaxId(bogPayment.user),
      lineItems: [{ description, amount: bogPayment.amount }],
      totalAmount: bogPayment.amount,
      platformFee,
      netAmount,
      currency: bogPayment.currency,
      status: 'PAID',
    };
    const pdf = await generateInvoicePdf(data);
    return sendPdf(res, pdf, `${invoiceNumber}.pdf`);
  }

  const stripePayment = await prisma.stripePayment.findUnique({
    where: { id: req.params.bogPaymentId },
    include: { user: userInvoiceSelect },
  });
  if (!stripePayment) return res.status(404).json({ message: 'Payment not found.' });
  const isOwner = stripePayment.userId === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You do not have access to this invoice.' });
  if (stripePayment.status !== 'COMPLETED') {
    return res.status(400).json({ message: 'An invoice is only available for a completed payment.' });
  }

  // false: never show a platformFee/netAmount breakdown here — those stored
  // values (ProductPurchase.commissionAmount/netAmount) are computed from
  // amountGel (GEL tetri, see that field's own schema comment), while this
  // invoice's totalAmount/currency below is stripePayment.amount in USD/EUR
  // minor units. Printing a GEL fee figure next to a USD total on the same
  // line would misrepresent the split, not just look odd — omitting it
  // entirely is the same "don't fabricate a number we can't stand behind"
  // posture the null-platformFee case already uses for admin-catalog sales.
  const { description } = await describePurchase(stripePayment.purpose, stripePayment.referenceId, stripePayment.userId, false);
  const invoiceNumber = invoiceNumberFor(stripePayment.id, stripePayment.completedAt ?? stripePayment.createdAt);
  const data: InvoiceData = {
    invoiceNumber,
    issueDate: stripePayment.completedAt ?? stripePayment.createdAt,
    buyerName: stripePayment.user.companyName || stripePayment.user.name,
    buyerEmail: stripePayment.user.email,
    buyerTaxId: buyerTaxId(stripePayment.user),
    lineItems: [{ description, amount: stripePayment.amount }],
    totalAmount: stripePayment.amount,
    platformFee: null,
    netAmount: null,
    currency: stripePayment.currency,
    status: 'PAID',
  };
  const pdf = await generateInvoicePdf(data);
  sendPdf(res, pdf, `${invoiceNumber}.pdf`);
});

// Escrow (gig) transaction invoice — shown to either party (client who
// funded it or freelancer who received the release), always includes the
// commission/net breakdown since that split is the whole point of this one.
router.get('/gig-transaction/:gigTransactionId/download', async (req: Request, res: Response) => {
  const transaction = await prisma.gigTransaction.findUnique({
    where: { id: req.params.gigTransactionId },
    include: {
      gig: { select: { title: true } },
      client: { select: { name: true, email: true, companyName: true, taxId: true, nationalId: true } },
      freelancer: { select: { name: true, email: true, taxId: true, nationalId: true } },
    },
  });
  if (!transaction) return res.status(404).json({ message: 'Escrow transaction not found.' });
  const isParty = transaction.clientId === req.user!.id || transaction.freelancerId === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  if (!isParty && !isAdmin) return res.status(403).json({ message: 'You do not have access to this invoice.' });

  // The client funded it (buyer); the freelancer is who the net amount was
  // released to — the invoice is framed from the client's (payer's) side,
  // same as a normal purchase receipt, regardless of who downloads it.
  const invoiceNumber = invoiceNumberFor(transaction.id, transaction.capturedAt);
  const data: InvoiceData = {
    invoiceNumber,
    issueDate: transaction.capturedAt,
    buyerName: transaction.client.companyName || transaction.client.name,
    buyerEmail: transaction.client.email,
    buyerTaxId: buyerTaxId(transaction.client),
    lineItems: [{ description: `Escrow: ${transaction.gig.title} (paid to ${transaction.freelancer.name})`, amount: transaction.grossAmount }],
    totalAmount: transaction.grossAmount,
    platformFee: transaction.commissionAmount,
    netAmount: transaction.netAmount,
    currency: transaction.currency,
    status: transaction.status === 'REFUNDED' ? 'REFUNDED' : 'PAID',
  };
  const pdf = await generateInvoicePdf(data);
  sendPdf(res, pdf, `${invoiceNumber}.pdf`);
});

// Unified SaaS billing engine's "current cycle" statement — the honest
// counterpart to the other two invoice routes above: those cover a real
// completed BogPayment/GigTransaction, but a BillingSubscription is never
// actually charged yet (see paymentGatewayService.ts), so this generates an
// ESTIMATE document (base fee + usage-to-date) rather than pretending
// something was paid. Becomes a real PAID invoice once a billing cycle
// actually closes and charges a card — deferred along with real gateway
// wiring (see billingService.sweepExpiredTrials's own comment).
router.get('/subscription/:subscriptionId/download', async (req: Request, res: Response) => {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { id: req.params.subscriptionId },
    include: { business: { select: { name: true, email: true, companyName: true, taxId: true, nationalId: true } } },
  });
  if (!subscription) return res.status(404).json({ message: 'Subscription not found.' });
  const isOwner = subscription.businessId === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You do not have access to this invoice.' });

  const usageTetri = await getCurrentCycleUsageTetri(subscription.id);
  const invoiceNumber = invoiceNumberFor(`${subscription.id}:${subscription.currentPeriodStart.getTime()}`, subscription.currentPeriodStart);
  const lineItems: InvoiceData['lineItems'] = [
    { description: `Platform Maintenance Base Fee (${subscription.productType})`, amount: subscription.baseFeeTetri },
  ];
  if (usageTetri > 0) {
    lineItems.push({ description: 'AI Agent Usage (current cycle, metered)', amount: usageTetri });
  }

  const data: InvoiceData = {
    invoiceNumber,
    issueDate: new Date(),
    buyerName: subscription.business.companyName || subscription.business.name,
    buyerEmail: subscription.business.email,
    buyerTaxId: buyerTaxId(subscription.business),
    lineItems,
    totalAmount: subscription.baseFeeTetri + usageTetri,
    currency: 'GEL',
    status: 'ESTIMATE',
  };
  const pdf = await generateInvoicePdf(data);
  sendPdf(res, pdf, `${invoiceNumber}.pdf`);
});

export default router;
