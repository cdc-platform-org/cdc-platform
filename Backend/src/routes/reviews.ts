import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createReviewSchema } from '../schemas/reviewSchemas';

const router = Router();
const participantSelect = { select: { id: true, name: true, role: true } };

router.post('/', authenticate, async (req: Request, res: Response) => {
  const result = createReviewSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const { gigId, rating, comment } = result.data;

  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) {
    return res.status(404).json({ message: 'Gig not found.' });
  }
  if (gig.status !== 'completed') {
    return res.status(400).json({ message: 'You can only review a gig once it is completed.' });
  }

  let revieweeId: string;
  let type: 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT';
  if (gig.postedById === req.user!.id) {
    if (!gig.assignedFreelancerId) {
      return res.status(400).json({ message: 'This gig has no assigned freelancer to review.' });
    }
    revieweeId = gig.assignedFreelancerId;
    type = 'CLIENT_TO_FREELANCER';
  } else if (gig.assignedFreelancerId === req.user!.id) {
    revieweeId = gig.postedById;
    type = 'FREELANCER_TO_CLIENT';
  } else {
    return res.status(403).json({ message: 'You are not a participant of this gig.' });
  }

  try {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          gigId,
          reviewerId: req.user!.id,
          revieweeId,
          rating,
          comment,
          type,
        },
        include: { reviewer: participantSelect, reviewee: participantSelect },
      });

      const aggregate = await tx.review.aggregate({
        where: { revieweeId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: revieweeId },
        data: {
          averageRating: aggregate._avg.rating ?? null,
          reviewCount: aggregate._count.rating,
        },
      });

      return created;
    });

    res.status(201).json({ data: review });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'You have already reviewed this gig.' });
    }
    throw err;
  }
});

// Scoped to the gig's two participants (+ admin-team) — unlike
// GET /user/:userId below (intentionally public: it's the reputation
// summary shown on a public profile), a single gig's review thread can
// include private-ish context and isn't meant for arbitrary logged-in
// users to browse by guessing gig IDs.
router.get('/gig/:gigId', authenticate, async (req: Request, res: Response) => {
  const gig = await prisma.gig.findUnique({
    where: { id: req.params.gigId },
    select: { id: true, postedById: true, assignedFreelancerId: true },
  });
  if (!gig) {
    return res.status(404).json({ message: 'Gig not found.' });
  }
  const isParticipant = gig.postedById === req.user!.id || gig.assignedFreelancerId === req.user!.id;
  if (!isParticipant) {
    const requester = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
    if (!requester?.adminRole) {
      return res.status(403).json({ message: 'You are not a participant of this gig.' });
    }
  }

  const reviews = await prisma.review.findMany({
    where: { gigId: gig.id },
    include: { reviewer: participantSelect, reviewee: participantSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: reviews });
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: {
      id: true,
      name: true,
      role: true,
      averageRating: true,
      reviewCount: true,
      isVerifiedGraduate: true,
      sellerRating: true,
      sellerReviewCount: true,
    },
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  const [reviews, verifiedSkills] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: req.params.userId },
      include: { reviewer: participantSelect, gig: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Per-skill "Verified Skill" badges — a separate, additive credential
    // from the single isVerifiedGraduate flag above (see VerifiedSkill's
    // schema comment). Public — no auth needed to see someone's earned badges.
    prisma.verifiedSkill.findMany({
      where: { userId: req.params.userId },
      select: { skillName: true, verifiedVia: true },
      orderBy: { verifiedAt: 'asc' },
    }),
  ]);
  res.json({ data: { user, reviews, verifiedSkills } });
});

export default router;
