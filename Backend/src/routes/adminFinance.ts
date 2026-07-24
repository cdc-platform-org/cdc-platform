import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { getBogOrderDetails } from '../services/bogPaymentService';
import { applyBogPaymentResult } from './payments';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
// Financials are SUPER_ADMIN only, per the RBAC hierarchy (MANAGER/MODERATOR
// don't see payment data at all).
router.use(authenticate, requireAdminRole('SUPER_ADMIN'));

const userSelect = { select: { id: true, name: true, email: true } };

// ============================================================
// COURSE-SALES LEDGER — BogPayment rows where purpose = COURSE. Distinct
// from adminPanel.ts's /financials/transactions, which is the GigTransaction
// (freelance-marketplace escrow) ledger.
// ============================================================
router.get('/course-payments', async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const where = { purpose: 'COURSE' as const, ...(status ? { status: status as any } : {}) };

  const [payments, totalCount] = await Promise.all([
    prisma.bogPayment.findMany({
      where,
      include: { user: userSelect },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bogPayment.count({ where }),
  ]);

  const courseIds = [...new Set(payments.map((p) => p.referenceId))];
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } });
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  res.json({
    data: payments.map((p) => ({
      id: p.id,
      bogOrderId: p.bogOrderId,
      user: p.user,
      courseId: p.referenceId,
      courseTitle: courseTitleById.get(p.referenceId) ?? '(deleted course)',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
    totalCount,
    page,
    pageSize,
  });
});

// Manual re-verification — re-queries BOG directly instead of waiting for
// the webhook callback, for when it drops.
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
  const fresh = await prisma.bogPayment.findUnique({ where: { id: payment.id } });
  res.json({ data: fresh });
});

// Refund & access revocation — marks the payment REFUNDED for bookkeeping
// and deletes the CourseEnrollment. Does NOT itself move money; the admin
// still processes the real bank refund via BOG separately.
router.post('/course-payments/:id/refund', async (req: Request, res: Response) => {
  const payment = await prisma.bogPayment.findUnique({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });

  await prisma.$transaction([
    prisma.bogPayment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } }),
    prisma.courseEnrollment.deleteMany({ where: { userId: payment.userId, courseId: payment.referenceId } }),
  ]);
  await logAdminAction({
    action: 'finance.payment.refund',
    targetType: 'BogPayment',
    targetId: payment.id,
    performedById: req.user!.id,
    metadata: { userId: payment.userId, courseId: payment.referenceId },
  });
  res.json({ message: 'Payment marked as refunded and course access revoked. Process the actual bank refund via BOG separately.' });
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

export default router;
