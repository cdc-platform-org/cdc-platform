import { prisma } from '../lib/prisma';

export type LearningRatingTarget = 'course' | 'live-training';

const reviewInclude = { user: { select: { id: true, name: true } } } as const;
const emptySummary = { averageRating: null, reviewCount: 0 };

export class LearningRatingError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function assertTargetExists(target: LearningRatingTarget, id: string) {
  const exists = target === 'course'
    ? await prisma.course.findUnique({ where: { id }, select: { id: true } })
    : await prisma.liveTraining.findFirst({ where: { id, published: true }, select: { id: true } });
  if (!exists) throw new LearningRatingError(404, 'Course or live training not found.');
}

async function isEligible(target: LearningRatingTarget, id: string, userId?: string): Promise<boolean> {
  if (!userId) return false;
  if (target === 'course') {
    return !!await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: id } }, select: { id: true },
    });
  }
  const enrollment = await prisma.liveTrainingEnrollment.findUnique({
    where: { userId_liveTrainingId: { userId, liveTrainingId: id } }, select: { status: true },
  });
  return enrollment?.status === 'ACTIVE' || enrollment?.status === 'COMPLETED';
}

// Aggregates always cover all reviews, even when the public list is limited.
// Fetching the caller's review separately lets them edit an older review.
export async function getLearningRatings(target: LearningRatingTarget, id: string, userId?: string) {
  await assertTargetExists(target, id);
  if (target === 'course') {
    const [aggregate, reviews, myReview, canReview] = await Promise.all([
      prisma.courseRating.aggregate({ where: { courseId: id }, _avg: { rating: true }, _count: { rating: true } }),
      prisma.courseRating.findMany({ where: { courseId: id }, include: reviewInclude, orderBy: { createdAt: 'desc' }, take: 50 }),
      userId ? prisma.courseRating.findUnique({ where: { userId_courseId: { userId, courseId: id } }, include: reviewInclude }) : null,
      isEligible(target, id, userId),
    ]);
    return { averageRating: aggregate._avg.rating, reviewCount: aggregate._count.rating, reviews, myReview, canReview };
  }
  const [aggregate, reviews, myReview, canReview] = await Promise.all([
    prisma.liveTrainingRating.aggregate({ where: { liveTrainingId: id }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.liveTrainingRating.findMany({ where: { liveTrainingId: id }, include: reviewInclude, orderBy: { createdAt: 'desc' }, take: 50 }),
    userId ? prisma.liveTrainingRating.findUnique({ where: { userId_liveTrainingId: { userId, liveTrainingId: id } }, include: reviewInclude }) : null,
    isEligible(target, id, userId),
  ]);
  return { averageRating: aggregate._avg.rating, reviewCount: aggregate._count.rating, reviews, myReview, canReview };
}

export async function saveLearningRating(
  target: LearningRatingTarget, id: string, userId: string, input: { rating: number; comment?: string | null },
) {
  await assertTargetExists(target, id);
  if (!await isEligible(target, id, userId)) {
    throw new LearningRatingError(403, 'You must be enrolled in this course or live training to leave a review.');
  }
  const data = { rating: input.rating, comment: input.comment?.trim() || null };
  // No nested includes: Prisma can use a native database upsert, so two
  // concurrent submissions cannot produce duplicate learner reviews.
  if (target === 'course') {
    await prisma.courseRating.upsert({
      where: { userId_courseId: { userId, courseId: id } },
      create: { courseId: id, userId, ...data }, update: data,
    });
  } else {
    await prisma.liveTrainingRating.upsert({
      where: { userId_liveTrainingId: { userId, liveTrainingId: id } },
      create: { liveTrainingId: id, userId, ...data }, update: data,
    });
  }
  return getLearningRatings(target, id, userId);
}

// One aggregate query for the entire catalog, rather than one query per card.
export async function withCourseRatings<T extends { id: string }>(courses: T[]) {
  if (!courses.length) return [];
  const groups = await prisma.courseRating.groupBy({
    by: ['courseId'], where: { courseId: { in: courses.map((course) => course.id) } },
    _avg: { rating: true }, _count: { rating: true },
  });
  const summaries = new Map(groups.map((group) => [group.courseId, { averageRating: group._avg.rating, reviewCount: group._count.rating }]));
  return courses.map((course) => ({ ...course, ...(summaries.get(course.id) ?? emptySummary) }));
}

export async function withTrainingRatings<T extends { id: string }>(trainings: T[]) {
  if (!trainings.length) return [];
  const groups = await prisma.liveTrainingRating.groupBy({
    by: ['liveTrainingId'], where: { liveTrainingId: { in: trainings.map((training) => training.id) } },
    _avg: { rating: true }, _count: { rating: true },
  });
  const summaries = new Map(groups.map((group) => [group.liveTrainingId, { averageRating: group._avg.rating, reviewCount: group._count.rating }]));
  return trainings.map((training) => ({ ...training, ...(summaries.get(training.id) ?? emptySummary) }));
}
