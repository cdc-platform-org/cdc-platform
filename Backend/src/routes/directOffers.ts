import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requireApproved } from '../middleware/auth';
import { createDirectOfferSchema } from '../schemas/directOfferSchemas';

const router = Router();
const participantSelect = { select: { id: true, name: true, role: true, isVerifiedGraduate: true } };
const gigSelect = { select: { id: true, title: true } };

router.post(
  '/',
  authenticate,
  requireApproved,
  requireRole('Client', 'SuperAdmin'),
  async (req: Request, res: Response) => {
    const result = createDirectOfferSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const { freelancerId, gigId, ...offerData } = result.data;

    const freelancer = await prisma.user.findUnique({ where: { id: freelancerId } });
    if (!freelancer || freelancer.role !== 'Student') {
      return res.status(400).json({ message: 'This user is not a freelancer.' });
    }
    if (freelancer.status !== 'APPROVED') {
      return res.status(400).json({ message: 'This freelancer is not yet approved on the platform.' });
    }

    if (gigId) {
      const gig = await prisma.gig.findUnique({ where: { id: gigId } });
      if (!gig) return res.status(404).json({ message: 'Gig not found.' });
      if (gig.postedById !== req.user!.id && req.user!.role !== 'SuperAdmin') {
        return res.status(403).json({ message: 'You can only attach an offer to your own gig.' });
      }
      if (gig.status !== 'open') {
        return res.status(400).json({ message: 'This gig is no longer open.' });
      }
    }

    const offer = await prisma.directOffer.create({
      data: {
        ...offerData,
        gigId: gigId ?? null,
        clientId: req.user!.id,
        freelancerId,
        status: 'pending',
      },
      include: { client: participantSelect, freelancer: participantSelect, gig: gigSelect },
    });
    res.status(201).json({ data: offer });
  }
);

router.get('/', authenticate, async (req: Request, res: Response) => {
  const where = req.user!.role === 'Student' ? { freelancerId: req.user!.id } : { clientId: req.user!.id };
  const offers = await prisma.directOffer.findMany({
    where,
    include: { client: participantSelect, freelancer: participantSelect, gig: gigSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: offers });
});

export default router;
