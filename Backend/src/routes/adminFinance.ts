import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { getBogOrderDetails } from '../services/bogPaymentService';
import { getStripeCheckoutSession } from '../services/stripePaymentService';
import { applyBogPaymentResult } from './payments';
import { applyStripePaymentResult, markStripeCheckoutExpired } from './stripePayments';
import { logAdminAction } from '../services/auditLogService';
import { getBillingSettings } from '../services/billingService';
import { updateBillingSettingsSchema } from '../schemas/billingSchemas';
import { refundBogPayment, RefundError } from '../services/bogRefundService';

const router = Router();
// Financials are SUPER_ADMIN only, per the RBAC hierarchy (MANAGER/MODERATOR
// don't see payment data at all).
router.use(authenticate, requireAdminRole('SUPER_ADMIN'));

const userSelect = { select: { id: true, name: true, email: true } };

// Single-row counterpart of the batched referenceLabel() inside the ledger
// route below — used by both reverify endpoints so their response is
// shaped identically to a normal ledger row (courseTitle/gateway/orderId
// included), not a raw Prisma row missing those fields. A stale/missing
// courseTitle after a reverify would otherwise blank out that column in
// the admin table until the next full list reload.
async function resolveReferenceLabel(purpose: string, referenceId: string): Promise<string> {
  if (purpose === 'COURSE') {
    const course = await prisma.course.findUnique({ where: { id: referenceId }, select: { title: true } });
    return course?.title ?? '(deleted course)';
  }
  if (purpose === 'MENTORSHIP') {
    const mentor = await prisma.user.findUnique({ where: { id: referenceId }, select: { name: true } });
    return mentor?.name ?? '(deleted mentor)';
  }
  if (purpose === 'GIG_ESCROW_FUNDING') {
    const gig = await prisma.gig.findUnique({ where: { id: referenceId }, select: { title: true } });
    return gig?.title ?? '(deleted gig)';
  }
  if (purpose === 'PRODUCT') {
    const product = await prisma.digitalProduct.findUnique({ where: { id: referenceId }, select: { title: true } });
    return product?.title ?? '(deleted product)';
  }
  if (purpose === 'LIVE_TRAINING') {
    const training = await prisma.liveTraining.findUnique({ where: { id: referenceId }, select: { title: true } });
    return training?.title ?? '(deleted live training)';
  }
  if (purpose === 'CHILDRENS_BOOK') {
    const book = await prisma.bookProject.findUnique({ where: { id: referenceId }, select: { title: true } });
    return book?.title || "Children's book";
  }
  if (purpose === 'ENGLISH_TUTOR_SUBSCRIPTION') return 'AI English Tutor (30 days)';
  if (purpose === 'HR_SUPPORT') return 'HR support request';
  return referenceId;
}

// ============================================================
// PAYMENT LEDGER — merges BogPayment and StripePayment rows (COURSE/
// MENTORSHIP/GIG_ESCROW_FUNDING/HR_SUPPORT) into one admin view, each
// tagged with its `gateway` so the frontend calls the right
// gateway-specific reverify endpoint. Distinct from adminPanel.ts's
// /financials/transactions, which is the GigTransaction (freelance-
// marketplace escrow payout) ledger downstream of this one. Endpoint path
// kept as /course-payments for backward compatibility with existing
// callers/bookmarks; it now covers every payment purpose AND both payment
// gateways by default.
//
// AUDIT NOTE (fixed): this used to only ever query BogPayment — a Stripe
// payment that completed on Stripe's side but failed mid-fulfillment (see
// applyStripePaymentResult's own comment) was invisible to admins entirely,
// with no ledger row to even notice the problem on, let alone a way to
// retry it. Merged in-process (not a DB-level UNION) since both tables are
// small at this platform's current scale — see the shared `where` filter
// applied identically to both queries below.
// ============================================================
router.get('/course-payments', async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const purpose = typeof req.query.purpose === 'string' ? req.query.purpose : undefined;

  const where = { ...(purpose ? { purpose: purpose as any } : {}), ...(status ? { status: status as any } : {}) };

  const [bogPayments, stripePayments] = await Promise.all([
    prisma.bogPayment.findMany({ where, include: { user: userSelect }, orderBy: { createdAt: 'desc' } }),
    prisma.stripePayment.findMany({ where, include: { user: userSelect }, orderBy: { createdAt: 'desc' } }),
  ]);

  type MergedRow = { id: string; gateway: 'BOG' | 'STRIPE'; orderId: string } & Pick<
    (typeof bogPayments)[number],
    'user' | 'purpose' | 'referenceId' | 'amount' | 'currency' | 'status' | 'createdAt' | 'completedAt'
  > & { refundedAmount: number };
  const merged: MergedRow[] = [
    ...bogPayments.map((p) => ({ id: p.id, gateway: 'BOG' as const, orderId: p.bogOrderId, user: p.user, purpose: p.purpose, referenceId: p.referenceId, amount: p.amount, currency: p.currency, status: p.status, createdAt: p.createdAt, completedAt: p.completedAt, refundedAmount: p.refundedAmount })),
    ...stripePayments.map((p) => ({ id: p.id, gateway: 'STRIPE' as const, orderId: p.stripeSessionId, user: p.user, purpose: p.purpose, referenceId: p.referenceId, amount: p.amount, currency: p.currency, status: p.status, createdAt: p.createdAt, completedAt: p.completedAt, refundedAmount: 0 })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalCount = merged.length;
  const pageRows = merged.slice((page - 1) * pageSize, page * pageSize);

  const courseIds = [...new Set(pageRows.filter((p) => p.purpose === 'COURSE').map((p) => p.referenceId))];
  const mentorIds = [...new Set(pageRows.filter((p) => p.purpose === 'MENTORSHIP').map((p) => p.referenceId))];
  const gigIds = [...new Set(pageRows.filter((p) => p.purpose === 'GIG_ESCROW_FUNDING').map((p) => p.referenceId))];
  const idsFor = (purpose: string) => [...new Set(pageRows.filter((p) => p.purpose === purpose).map((p) => p.referenceId))];
  const [courses, mentors, gigs, products, trainings, books] = await Promise.all([
    prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }),
    prisma.user.findMany({ where: { id: { in: mentorIds } }, select: { id: true, name: true } }),
    prisma.gig.findMany({ where: { id: { in: gigIds } }, select: { id: true, title: true } }),
    prisma.digitalProduct.findMany({ where: { id: { in: idsFor('PRODUCT') } }, select: { id: true, title: true } }),
    prisma.liveTraining.findMany({ where: { id: { in: idsFor('LIVE_TRAINING') } }, select: { id: true, title: true } }),
    prisma.bookProject.findMany({ where: { id: { in: idsFor('CHILDRENS_BOOK') } }, select: { id: true, title: true } }),
  ]);
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));
  const mentorNameById = new Map(mentors.map((m) => [m.id, m.name]));
  const gigTitleById = new Map(gigs.map((g) => [g.id, g.title]));
  const productTitleById = new Map(products.map((p) => [p.id, p.title]));
  const trainingTitleById = new Map(trainings.map((t) => [t.id, t.title]));
  const bookTitleById = new Map(books.map((b) => [b.id, b.title]));

  function referenceLabel(p: MergedRow): string {
    if (p.purpose === 'COURSE') return courseTitleById.get(p.referenceId) ?? '(deleted course)';
    if (p.purpose === 'MENTORSHIP') return mentorNameById.get(p.referenceId) ?? '(deleted mentor)';
    if (p.purpose === 'GIG_ESCROW_FUNDING') return gigTitleById.get(p.referenceId) ?? '(deleted gig)';
    if (p.purpose === 'PRODUCT') return productTitleById.get(p.referenceId) ?? '(deleted product)';
    if (p.purpose === 'LIVE_TRAINING') return trainingTitleById.get(p.referenceId) ?? '(deleted live training)';
    if (p.purpose === 'CHILDRENS_BOOK') return bookTitleById.get(p.referenceId) || "Children's book";
    if (p.purpose === 'ENGLISH_TUTOR_SUBSCRIPTION') return 'AI English Tutor (30 days)';
    if (p.purpose === 'HR_SUPPORT') return 'HR support request';
    return p.referenceId;
  }

  res.json({
    data: pageRows.map((p) => ({
      id: p.id,
      gateway: p.gateway,
      bogOrderId: p.orderId,
      user: p.user,
      purpose: p.purpose,
      courseId: p.referenceId,
      courseTitle: referenceLabel(p),
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      refundedAmount: p.refundedAmount,
    })),
    totalCount,
    page,
    pageSize,
  });
});

// Manual re-verification — re-queries BOG directly instead of waiting for
// the webhook callback, for when it drops. Deliberately NOT restricted to
// PENDING rows: applyBogPaymentResult's own fulfillment steps are each
// idempotent (isNewEnrollment flag, existingTransaction check, etc.), so
// re-running it on an already-COMPLETED row that failed mid-fulfillment
// (payment succeeded on BOG's side, but e.g. enrollment never landed) is
// exactly the recovery path this endpoint exists for, not just a status re-check.
router.post('/course-payments/:id/reverify', async (req: Request, res: Response) => {
  const payment = await prisma.bogPayment.findUnique({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });
  if (payment.bogOrderId.startsWith('pending-')) {
    return res.status(400).json({ message: 'This payment never reached BOG (no real order was created).' });
  }
  try {
    const details = await getBogOrderDetails(payment.bogOrderId);
    await applyBogPaymentResult(payment.id, details.order_status.key, { reconciledFrom: 'admin-manual-reverify', details });
  } catch (err) {
    return res.status(502).json({ message: 'Failed to reach BOG for status re-verification.' });
  }
  await logAdminAction({ action: 'finance.payment.reverify', targetType: 'BogPayment', targetId: payment.id, performedById: req.user!.id });
  const fresh = await prisma.bogPayment.findUnique({ where: { id: payment.id }, include: { user: userSelect } });
  if (!fresh) return res.status(404).json({ message: 'Payment not found.' });
  res.json({
    data: {
      id: fresh.id,
      gateway: 'BOG' as const,
      bogOrderId: fresh.bogOrderId,
      user: fresh.user,
      purpose: fresh.purpose,
      courseId: fresh.referenceId,
      courseTitle: await resolveReferenceLabel(fresh.purpose, fresh.referenceId),
      amount: fresh.amount,
      currency: fresh.currency,
      status: fresh.status,
      createdAt: fresh.createdAt,
      completedAt: fresh.completedAt,
      refundedAmount: fresh.refundedAmount,
    },
  });
});

// Stripe counterpart of the BOG reverify above — the actual gap this audit
// fixed: previously there was no admin recovery path at all for a Stripe
// payment whose fulfillment failed after applyStripePaymentResult's status
// write already flipped it to COMPLETED (which then makes the webhook's own
// PENDING-only idempotency guard permanently skip re-processing it, and
// paymentReconciliationService's cron sweep only ever looks at rows still
// PENDING). Same "safe to re-run on a non-PENDING row" reasoning as BOG's
// version — every fulfillment branch inside applyStripePaymentResult is
// independently idempotent.
router.post('/course-payments/:id/reverify-stripe', async (req: Request, res: Response) => {
  const payment = await prisma.stripePayment.findUnique({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });

  try {
    const session = await getStripeCheckoutSession(payment.stripeSessionId);
    if (session.status === 'complete' && session.payment_status === 'paid') {
      await applyStripePaymentResult(payment.id, session, { reconciledFrom: 'admin-manual-reverify' });
    } else if (session.status === 'expired') {
      await markStripeCheckoutExpired(payment.id, { reconciledFrom: 'admin-manual-reverify' });
    }
    // else: session.status === 'open' — buyer hasn't finished checkout yet, nothing to reconcile.
  } catch (err) {
    return res.status(502).json({ message: 'Failed to reach Stripe for status re-verification.' });
  }
  await logAdminAction({ action: 'finance.payment.reverify', targetType: 'StripePayment', targetId: payment.id, performedById: req.user!.id });
  const fresh = await prisma.stripePayment.findUnique({ where: { id: payment.id }, include: { user: userSelect } });
  if (!fresh) return res.status(404).json({ message: 'Payment not found.' });
  res.json({
    data: {
      id: fresh.id,
      gateway: 'STRIPE' as const,
      bogOrderId: fresh.stripeSessionId,
      user: fresh.user,
      purpose: fresh.purpose,
      courseId: fresh.referenceId,
      courseTitle: await resolveReferenceLabel(fresh.purpose, fresh.referenceId),
      amount: fresh.amount,
      currency: fresh.currency,
      status: fresh.status,
      createdAt: fresh.createdAt,
      completedAt: fresh.completedAt,
      refundedAmount: 0,
    },
  });
});

// Refund — full or partial — through BOG's refund API (or "record only"
// when the admin already refunded it in BOG's own dashboard). Records a
// BogRefund row, updates BogPayment.status/refundedAmount, claws back the
// creator's share, optionally revokes the buyer's access, and writes an
// audit log entry. See services/bogRefundService.ts for the full flow.
const refundSchema = z.object({
  // Major units as typed by the admin (e.g. 2.50). Omitted = refund
  // everything that is left.
  amount: z.number().positive().max(1_000_000).optional(),
  revokeAccess: z.boolean().default(true),
  recordOnly: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
});

router.post('/course-payments/:id/refund', async (req: Request, res: Response) => {
  const parsed = refundSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  const { amount, revokeAccess, recordOnly, reason } = parsed.data;
  try {
    const result = await refundBogPayment({
      bogPaymentId: req.params.id,
      amount: amount === undefined ? undefined : Math.round(amount * 100),
      revokeAccess,
      recordOnly,
      reason: reason || undefined,
      adminId: req.user!.id,
    });
    const verb = recordOnly ? 'recorded as refunded' : 'sent to BOG';
    res.json({
      data: result,
      message: `Refund of ${(result.amount / 100).toFixed(2)} ${verb}. ${result.access.note}`,
    });
  } catch (err) {
    if (err instanceof RefundError) return res.status(err.httpStatus).json({ message: err.message });
    throw err;
  }
});

// Refund history for one payment — shown in the refund dialog.
router.get('/course-payments/:id/refunds', async (req: Request, res: Response) => {
  const refunds = await prisma.bogRefund.findMany({
    where: { bogPaymentId: req.params.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, amount: true, status: true, recordOnly: true, reason: true, accessRevoked: true,
      errorMessage: true, createdAt: true, completedAt: true, requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ data: refunds });
});

// ============================================================
// MANUAL COURSE GRANTING — admin override for bank-transfer payments that
// never went through BOG checkout at all.
// ============================================================
const grantSchema = z.object({
  userEmail: z.string().email(),
  courseId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

router.post('/course-access/grant', async (req: Request, res: Response) => {
  const result = grantSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { email: result.data.userEmail } }),
    prisma.course.findUnique({ where: { id: result.data.courseId } }),
  ]);
  if (!user) return res.status(404).json({ message: 'No user found with that email.' });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const enrollment = await prisma.courseEnrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: { userId: user.id, courseId: course.id },
  });
  await logAdminAction({
    action: 'finance.course.manual-grant',
    targetType: 'CourseEnrollment',
    targetId: `${user.id}:${course.id}`,
    performedById: req.user!.id,
    metadata: { note: result.data.note, courseTitle: course.title, userEmail: user.email },
  });
  res.status(201).json({ data: enrollment });
});

// ============================================================
// BILLING SETTINGS — the unified SaaS billing engine's pricing knobs (base
// fee/month, usage margin multiplier, trial length). Same singleton-row
// pattern as /bog-settings in adminPanel.ts. Reads always fall back to
// billingService's hardcoded defaults when no row has been saved yet, so
// the trial/usage flow works out of the box before an admin ever visits
// this page.
// ============================================================
router.get('/billing-settings', async (_req: Request, res: Response) => {
  const settings = await getBillingSettings();
  res.json({ data: settings });
});

router.put('/billing-settings', async (req: Request, res: Response) => {
  const result = updateBillingSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const existing = await prisma.billingSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  // "" means "clear this field" (see updateBillingSettingsSchema's own
  // comment) — normalized to null here, after validation, so an explicit
  // clear reaches Prisma as `null` while an omitted field stays absent
  // from `data` and leaves the stored value untouched.
  const normalized = { ...result.data };
  for (const key of ['bankTransferIban', 'bankTransferBankName', 'bankTransferAccountName'] as const) {
    if (normalized[key] === '') normalized[key] = null;
  }
  const data = { ...normalized, updatedByEmail: req.user!.email };
  const settings = existing
    ? await prisma.billingSettings.update({ where: { id: existing.id }, data })
    : await prisma.billingSettings.create({ data });

  await logAdminAction({
    action: 'finance.billing-settings.update',
    targetType: 'BillingSettings',
    targetId: settings.id,
    performedById: req.user!.id,
    metadata: result.data,
  });

  res.json({ data: settings });
});

export default router;
