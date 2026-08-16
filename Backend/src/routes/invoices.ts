import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { generateInvoicePdf, InvoiceData } from '../services/invoiceService';

const router = Router();
router.use(authenticate);

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

// Course / Digital Product / Mentorship / Gig-escrow-funding purchase
// invoice — one BogPayment is one completed checkout, see routes/payments.ts.
router.get('/payment/:bogPaymentId/download', async (req: Request, res: Response) => {
  const payment = await prisma.bogPayment.findUnique({
    where: { id: req.params.bogPaymentId },
    include: { user: { select: { name: true, email: true, companyName: true, taxId: true, nationalId: true } } },
  });
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });
  const isOwner = payment.userId === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You do not have access to this invoice.' });
  if (payment.status !== 'COMPLETED') {
    return res.status(400).json({ message: 'An invoice is only available for a completed payment.' });
  }

  let description = 'CDC Platform purchase';
  let platformFee: number | null = null;
  let netAmount: number | null = null;

  if (payment.purpose === 'COURSE') {
    const course = await prisma.course.findUnique({ where: { id: payment.referenceId }, select: { title: true } });
    description = course ? `Course enrollment: ${course.title}` : 'Course enrollment';
  } else if (payment.purpose === 'PRODUCT') {
    const [product, purchase] = await Promise.all([
      prisma.digitalProduct.findUnique({ where: { id: payment.referenceId }, select: { title: true } }),
      prisma.productPurchase.findUnique({
        where: { userId_productId: { userId: payment.userId, productId: payment.referenceId } },
        select: { commissionAmount: true, netAmount: true },
      }),
    ]);
    description = product ? `Digital Store purchase: ${product.title}` : 'Digital Store purchase';
    // Only a real external creator's sale has a commission split at all —
    // admin-catalog products keep 100% with no split, see productSaleService.ts.
    platformFee = purchase?.commissionAmount ?? null;
    netAmount = purchase?.netAmount ?? null;
  } else if (payment.purpose === 'MENTORSHIP') {
    const mentor = await prisma.user.findUnique({ where: { id: payment.referenceId }, select: { name: true } });
    description = mentor ? `Mentorship session with ${mentor.name}` : 'Mentorship session';
  } else if (payment.purpose === 'GIG_ESCROW_FUNDING') {
    const gig = await prisma.gig.findUnique({ where: { id: payment.referenceId }, select: { title: true } });
    description = gig ? `Escrow funding: ${gig.title}` : 'Escrow funding';
  }

  const invoiceNumber = invoiceNumberFor(payment.id, payment.completedAt ?? payment.createdAt);
  const data: InvoiceData = {
    invoiceNumber,
    issueDate: payment.completedAt ?? payment.createdAt,
    buyerName: payment.user.companyName || payment.user.name,
    buyerEmail: payment.user.email,
    buyerTaxId: buyerTaxId(payment.user),
    lineItems: [{ description, amount: payment.amount }],
    totalAmount: payment.amount,
    platformFee,
    netAmount,
    currency: payment.currency,
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

export default router;
