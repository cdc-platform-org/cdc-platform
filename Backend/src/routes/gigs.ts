import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requireApproved } from '../middleware/auth';
import { postGigSchema, applyToGigSchema, submitGigWorkSchema } from '../schemas/gigSchemas';
import { openDisputeSchema } from '../schemas/disputeSchemas';
import { captureEscrow } from '../services/escrowService';
import { approveGigWork, GigApprovalError } from '../services/gigApprovalService';
import { z } from 'zod';

const router = Router();
const posterSelect = { select: { id: true, name: true, role: true, isVerifiedGraduate: true } };
const applicantSelect = { select: { id: true, name: true, isVerifiedGraduate: true } };

declare global {
  namespace Express {
    interface Request {
      gig?: NonNullable<Awaited<ReturnType<typeof prisma.gig.findUnique>>>;
    }
  }
}

async function loadGig(req: Request, res: Response, next: Function) {
  const gig = await prisma.gig.findUnique({ where: { id: req.params.id } });
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  req.gig = gig;
  next();
}

function requireGigOwnerOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.user || !req.gig) return res.status(401).json({ message: 'Authentication required.' });
  const isOwner = req.gig.postedById === req.user.id;
  const isAdmin = req.user.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(404).json({ message: 'Gig not found.' });
  next();
}

// Public — guests can browse the job board without logging in. Only
// action routes below (apply, post, approve, etc.) require authentication.
router.get('/', async (req: Request, res: Response) => {
  const { skills, budgetType, status } = req.query;
  // Moderators can take down a listing after the fact (moderationStatus ->
  // removed) — this is the public browse route, so removed listings never
  // show up here regardless of who's asking. The admin panel's own
  // /admin-panel/listings route shows everything, including removed ones.
  const where: Record<string, unknown> = { moderationStatus: 'approved' };
  if (status) where.status = status;
  if (budgetType) where.budgetType = budgetType;
  if (skills) where.skillsRequired = { hasSome: String(skills).split(',').map((s) => s.trim()) };
  const gigs = await prisma.gig.findMany({
    where,
    include: { postedBy: posterSelect, assignedFreelancer: posterSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json(gigs);
});

// Client Portal — gigs the caller posted, with enough info to render "order
// briefs, project statuses, and invoices" without extra round-trips. Must be
// registered before GET /:id, or a request to /mine would match :id="mine".
router.get('/mine', authenticate, requireApproved, async (req: Request, res: Response) => {
  const gigs = await prisma.gig.findMany({
    where: { postedById: req.user!.id },
    include: {
      assignedFreelancer: posterSelect,
      transaction: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(gigs);
});

// The freelancer-side counterpart to /mine above — gigs the current user is
// assigned to work on, for their dashboard workspace. Also registered
// before GET /:id for the same route-ordering reason.
router.get('/assigned-to-me', authenticate, requireApproved, async (req: Request, res: Response) => {
  const gigs = await prisma.gig.findMany({
    where: { assignedFreelancerId: req.user!.id },
    include: { postedBy: posterSelect, transaction: true },
    orderBy: { createdAt: 'desc' },
  });
  const completedCount = await prisma.gig.count({ where: { assignedFreelancerId: req.user!.id, status: 'completed' } });
  res.json(
    gigs.map((gig) => ({
      ...gig,
      // Same "is this their first-ever gig" computation as GET /:id — a
      // completed gig doesn't count itself, so this stays accurate even
      // for the gig that just became their first completion.
      isFirstOrder: gig.status === 'completed' ? completedCount <= 1 : completedCount === 0,
    }))
  );
});

router.get('/:id', async (req: Request, res: Response) => {
  const gig = await prisma.gig.findUnique({
    where: { id: req.params.id },
    include: { postedBy: posterSelect, assignedFreelancer: posterSelect },
  });
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });

  // Computed, not stored — "is this the freelancer's first-ever gig" is
  // derived from their completed-gig count so it can never drift out of
  // sync with reality. Only meaningful once a freelancer is assigned.
  let isFirstOrder = false;
  if (gig.assignedFreelancerId) {
    const priorCompletedCount = await prisma.gig.count({
      where: { assignedFreelancerId: gig.assignedFreelancerId, status: 'completed', id: { not: gig.id } },
    });
    isFirstOrder = priorCompletedCount === 0;
  }
  res.json({ ...gig, isFirstOrder });
});

// Freelancer-only — surfaces in the admin mentorship queue
// (GET /api/admin/mentorship).
router.post('/:id/request-mentor-help', authenticate, requireApproved, loadGig, async (req: Request, res: Response) => {
  if (req.gig!.assignedFreelancerId !== req.user!.id) {
    return res.status(403).json({ message: 'Only the assigned freelancer can request mentor help on this gig.' });
  }
  const gig = await prisma.gig.update({ where: { id: req.gig!.id }, data: { mentorHelpRequestedAt: new Date() } });
  res.json(gig);
});

// Either participant (client or freelancer) can open a dispute once work
// has been submitted.
router.post('/:id/dispute', authenticate, requireApproved, loadGig, async (req: Request, res: Response) => {
  const result = openDisputeSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const isParticipant = req.gig!.postedById === req.user!.id || req.gig!.assignedFreelancerId === req.user!.id;
  if (!isParticipant) {
    return res.status(403).json({ message: 'Only the client or assigned freelancer can open a dispute on this gig.' });
  }
  const existing = await prisma.dispute.findFirst({ where: { gigId: req.gig!.id, status: 'OPEN' } });
  if (existing) {
    return res.status(409).json({ message: 'There is already an open dispute for this gig.' });
  }
  const dispute = await prisma.dispute.create({
    data: { gigId: req.gig!.id, raisedById: req.user!.id, reason: result.data.reason },
  });
  res.status(201).json(dispute);
});

router.post(
  '/',
  authenticate,
  requireApproved,
  requireRole('Client', 'SuperAdmin'),
  async (req: Request, res: Response) => {
    const result = postGigSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const gig = await prisma.gig.create({
      data: { ...result.data, postedById: req.user!.id, status: 'open' },
      include: { postedBy: posterSelect },
    });
    res.status(201).json(gig);
  }
);

router.post(
  '/:id/apply',
  authenticate,
  requireApproved,
  requireRole('Student'),
  loadGig,
  async (req: Request, res: Response) => {
    if (req.gig!.status !== 'open') {
      return res.status(400).json({ message: 'This gig is no longer accepting applications.' });
    }
    // Client-side (ProposalModal) also checks this, but that's UX only — the
    // real gate has to live here, since anyone can call this endpoint directly.
    const applicant = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isVerifiedGraduate: true },
    });
    if (!applicant?.isVerifiedGraduate) {
      return res.status(403).json({ message: 'Only verified CDC graduates can submit proposals.' });
    }
    const result = applyToGigSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    try {
      const [application] = await prisma.$transaction([
        prisma.gigApplication.create({
          data: {
            gigId: req.gig!.id,
            applicantId: req.user!.id,
            proposalNote: result.data.proposalNote,
            bidAmount: result.data.bidAmount,
            deliveryDays: result.data.deliveryDays,
            status: 'submitted',
          },
          include: { applicant: applicantSelect },
        }),
        prisma.gig.update({
          where: { id: req.gig!.id },
          data: { applicationsCount: { increment: 1 } },
        }),
      ]);
      res.status(201).json(application);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ message: 'You have already applied to this gig.' });
      }
      throw err;
    }
  }
);

router.get(
  '/:id/applications',
  authenticate,
  loadGig,
  requireGigOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const applications = await prisma.gigApplication.findMany({
      where: { gigId: req.gig!.id },
      include: { applicant: applicantSelect },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  }
);

router.post(
  '/:id/applications/:appId/approve',
  authenticate,
  loadGig,
  requireGigOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const application = await prisma.gigApplication.findFirst({
      where: { id: req.params.appId, gigId: req.gig!.id },
    });
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    if (!['submitted', 'reviewed'].includes(application.status)) {
      return res.status(400).json({ message: 'This application has already been decided.' });
    }
    const [, , updatedGig] = await prisma.$transaction([
      prisma.gigApplication.update({ where: { id: application.id }, data: { status: 'accepted' } }),
      prisma.gigApplication.updateMany({
        where: { gigId: req.gig!.id, id: { not: application.id }, status: { in: ['submitted', 'reviewed'] } },
        data: { status: 'rejected' },
      }),
      prisma.gig.update({
        where: { id: req.gig!.id },
        data: { status: 'assigned', assignedFreelancerId: application.applicantId },
        include: { postedBy: posterSelect },
      }),
    ]);
    res.json(updatedGig);
  }
);

router.post(
  '/:id/applications/:appId/reject',
  authenticate,
  loadGig,
  requireGigOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const application = await prisma.gigApplication.findFirst({
      where: { id: req.params.appId, gigId: req.gig!.id },
    });
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    const updated = await prisma.gigApplication.update({
      where: { id: application.id },
      data: { status: 'rejected' },
      include: { applicant: applicantSelect },
    });
    res.json(updated);
  }
);

router.post('/:id/submit', authenticate, loadGig, async (req: Request, res: Response) => {
  if (req.gig!.assignedFreelancerId !== req.user!.id) {
    return res.status(403).json({ message: 'Only the assigned freelancer can submit work for this gig.' });
  }
  if (req.gig!.status !== 'assigned') {
    return res.status(400).json({ message: 'This gig is not in a state that accepts submission.' });
  }
  const result = submitGigWorkSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const updated = await prisma.gig.update({
    where: { id: req.gig!.id },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      deliveryComment: result.data.comment,
      deliveryFiles: result.data.files,
      deliveryLinks: result.data.links,
    },
    include: { postedBy: posterSelect, assignedFreelancer: posterSelect },
  });
  res.json(updated);
});

// Client approves delivered work — releases escrow (10% platform fee, 90% net
// to the freelancer's balance) and marks the gig completed. The same
// approveGigWork() is also invoked automatically by the 7-day auto-approve
// cron (routes/cron.ts) when the client never responds.
router.post(
  '/:id/approve',
  authenticate,
  loadGig,
  requireGigOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { gig, transaction } = await approveGigWork(req.params.id);
      res.json({
        gig,
        transaction: {
          id: transaction.id,
          status: transaction.status,
          netAmount: transaction.netAmount,
          commissionAmount: transaction.commissionAmount,
          releasedAt: transaction.releasedAt,
        },
      });
    } catch (err: any) {
      if (err instanceof GigApprovalError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  }
);

const testCaptureSchema = z.object({
  grossAmount: z.number().int().positive(),
  currency: z.string().length(3).toUpperCase().default('GEL'),
});

if (process.env.NODE_ENV !== 'production') {
  router.post(
    '/:id/test-capture-escrow',
    authenticate,
    requireRole('SuperAdmin'),
    loadGig,
    async (req: Request, res: Response) => {
      const result = testCaptureSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ errors: result.error.errors });
      if (req.gig!.status !== 'assigned') {
        return res.status(400).json({ message: 'Gig must be in "assigned" status to simulate capture.' });
      }
      if (!req.gig!.assignedFreelancerId) {
        return res.status(400).json({ message: 'This gig has no assigned freelancer.' });
      }
      const application = await prisma.gigApplication.findFirst({
        where: { gigId: req.gig!.id, applicantId: req.gig!.assignedFreelancerId, status: 'accepted' },
      });
      if (!application) {
        return res.status(400).json({ message: 'No accepted application found for this gig.' });
      }
      const transaction = await captureEscrow({
        gigId: req.gig!.id,
        gigApplicationId: application.id,
        clientId: req.gig!.postedById,
        freelancerId: req.gig!.assignedFreelancerId,
        grossAmount: result.data.grossAmount,
        currency: result.data.currency,
        providerRef: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      res.status(201).json({ message: '⚠️ Simulated capture — no real payment processed.', transaction });
    }
  );
}

export default router;