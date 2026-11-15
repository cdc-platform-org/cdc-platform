import { DIGITAL_TOOLS } from '../../config/digitalTools';
/**
 * GET /my — the signed-in user's own payment history (dashboard wallet tab).
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';

const router = Router();

// ============================================================
// MY PAYMENT HISTORY — self-serve, for the dashboard. Every BogPayment row
// is a real completed-or-attempted BOG order across all three checkout
// flows (course/mentorship/gig-escrow) — referenceId is a polymorphic
// pointer (see the model's own comment), so for COURSE purchases a
// best-effort course title is resolved and attached; the other two
// purposes are self-descriptive already (mentorship's referenceId is
// already a free-text package label, gig-escrow's title isn't critical
// here since the Gigs tab covers that relationship in full).
// ============================================================
router.get('/my', authenticate, async (req: Request, res: Response) => {
  // Merges both gateways' rows into one history list — a user who paid via
  // Stripe for one purchase and BOG for another should see both, not just
  // whichever table this happened to query first.
  const [bogPayments, stripePayments] = await Promise.all([
    prisma.bogPayment.findMany({
      where: { userId: req.user!.id },
      include: { promoCode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stripePayment.findMany({
      where: { userId: req.user!.id },
      include: { promoCode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const payments = [
    ...bogPayments.map((p) => ({ ...p, gateway: 'BOG' as const })),
    ...stripePayments.map((p) => ({ ...p, gateway: 'STRIPE' as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const courseIds = payments.filter((p) => p.purpose === 'COURSE').map((p) => p.referenceId);
  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
    : [];
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  const productIds = payments.filter((p) => p.purpose === 'PRODUCT').map((p) => p.referenceId);
  const products = productIds.length
    ? await prisma.digitalProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } })
    : [];
  const productTitleById = new Map(products.map((p) => [p.id, p.title]));

  // HR_SUPPORT's referenceId is the HRSupportRequest.id, not the vacancy
  // itself — one extra hop via the request to get to a real title.
  const hrRequestIds = payments.filter((p) => p.purpose === 'HR_SUPPORT').map((p) => p.referenceId);
  const hrRequests = hrRequestIds.length
    ? await prisma.hRSupportRequest.findMany({
        where: { id: { in: hrRequestIds } },
        select: { id: true, vacancy: { select: { title: true } } },
      })
    : [];
  const hrRequestTitleById = new Map(hrRequests.map((r) => [r.id, r.vacancy.title]));

  res.json({
    data: payments.map((p) => ({
      id: p.id,
      gateway: p.gateway,
      purpose: p.purpose,
      referenceId: p.referenceId,
      referenceTitle:
        p.purpose === 'COURSE'
          ? courseTitleById.get(p.referenceId) ?? null
          : p.purpose === 'PRODUCT'
          ? productTitleById.get(p.referenceId) ?? null
          : p.purpose === 'AI_TOOL_SUBSCRIPTION'
          ? DIGITAL_TOOLS.find(tool => tool.key === p.referenceId)?.label ?? p.referenceId
          : p.purpose === 'HR_SUPPORT'
          ? hrRequestTitleById.get(p.referenceId) ?? null
          : null,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      promoCode: p.promoCode?.code ?? null,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
  });
});

export default router;
