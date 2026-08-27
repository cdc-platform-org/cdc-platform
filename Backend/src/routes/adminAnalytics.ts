import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/overview', async (_req: Request, res: Response) => {
  const completedCourseWhere = { purpose: 'COURSE' as const, status: 'COMPLETED' as const };
  // totalRevenue/totalSalesCount below stay genuinely all-time (DB-side
  // aggregate/count, cheap regardless of table size). This row-level fetch
  // is different: it used to pull every completed COURSE payment ever, with
  // no bound, just to compute a 12-month trend chart and a "top courses"
  // ranking in JS — bounding it to the same 12-month window the trend chart
  // actually needs keeps this query flat as the table grows, and reframes
  // "top courses" as a rolling last-12-months ranking rather than an
  // ever-more-expensive all-time one.
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const recentCourseWhere = { ...completedCourseWhere, completedAt: { gte: twelveMonthsAgo } };

  const [totalRevenueAgg, totalSalesCount, activeStudents, allCompletedPayments, courses] = await Promise.all([
    prisma.bogPayment.aggregate({ where: completedCourseWhere, _sum: { amount: true } }),
    prisma.bogPayment.count({ where: completedCourseWhere }),
    prisma.courseEnrollment.findMany({ select: { userId: true }, distinct: ['userId'] }),
    prisma.bogPayment.findMany({ where: recentCourseWhere, select: { amount: true, referenceId: true, completedAt: true } }),
    prisma.course.findMany({ select: { id: true, title: true } }),
  ]);

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  // Monthly sales trend — last 12 months, computed in JS (avoids a
  // raw-SQL date_trunc dependency for what's a small in-memory dataset).
  const monthBuckets = new Map<string, { revenue: number; count: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { revenue: 0, count: 0 });
  }
  for (const payment of allCompletedPayments) {
    if (!payment.completedAt) continue;
    const key = `${payment.completedAt.getFullYear()}-${String(payment.completedAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthBuckets.get(key);
    if (bucket) {
      bucket.revenue += payment.amount;
      bucket.count += 1;
    }
  }
  const monthlySales = Array.from(monthBuckets.entries()).map(([month, v]) => ({ month, ...v }));

  // Top-performing courses by revenue.
  const revenueByCourse = new Map<string, { revenue: number; salesCount: number }>();
  for (const payment of allCompletedPayments) {
    const entry = revenueByCourse.get(payment.referenceId) ?? { revenue: 0, salesCount: 0 };
    entry.revenue += payment.amount;
    entry.salesCount += 1;
    revenueByCourse.set(payment.referenceId, entry);
  }
  const topCourses = Array.from(revenueByCourse.entries())
    .map(([courseId, v]) => ({ courseId, courseTitle: courseTitleById.get(courseId) ?? '(deleted course)', ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json({
    data: {
      totalRevenue: totalRevenueAgg._sum.amount ?? 0,
      totalSalesCount,
      activeEnrolledStudents: activeStudents.length,
      monthlySales,
      topCourses,
    },
  });
});

export default router;
