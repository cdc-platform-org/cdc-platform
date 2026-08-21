import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import {
  updateCandidateEvaluationSchema,
  deliverHRSupportRequestSchema,
  disputeHRSupportRequestSchema,
} from '../schemas/hrSupportSchemas';
import { calculateHRSupportFee, HR_BASE_FEE, HR_INCLUDED_CANDIDATES, HR_EXTRA_CANDIDATE_FEE } from '../services/hrPricingService';
import { markHRSupportDelivered, releaseHRSupportEscrow, flagHRSupportEscrowForReview, HRSupportEscrowError } from '../services/hrSupportEscrowService';

const router = Router();

const specialistSelect = { select: { id: true, name: true, email: true } };
const evaluationInclude = {
  application: {
    include: { applicant: { select: { id: true, name: true, email: true, cvUrl: true, isVerifiedGraduate: true } } },
  },
};

declare global {
  namespace Express {
    interface Request {
      hrRequest?: NonNullable<Awaited<ReturnType<typeof prisma.hRSupportRequest.findUnique>>>;
      // Set by requireHrAccess — true for SUPER_ADMIN/MANAGER, false for a
      // plain isHrSpecialist account, so downstream handlers can tell "any
      // request" apart from "only requests assigned to me."
      isHrAdmin?: boolean;
    }
  }
}

async function loadHRRequest(req: Request, res: Response, next: NextFunction) {
  const request = await prisma.hRSupportRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ message: 'HR Assistance request not found.' });
  req.hrRequest = request;
  next();
}

function requireRequestOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.hrRequest) return res.status(401).json({ message: 'Authentication required.' });
  const isOwner = req.hrRequest.requestedById === req.user.id;
  if (!isOwner && req.user.role !== 'SuperAdmin') {
    return res.status(404).json({ message: 'HR Assistance request not found.' });
  }
  next();
}

// Grants access to any isHrSpecialist account or admin-team member (see the
// isHrSpecialist comment in schema.prisma — deliberately NOT the same gate
// as requireAdminRole, since a specialist should never get the general
// admin panel). Individual routes below still additionally check that a
// non-admin specialist is only ever acting on a request assigned to them.
async function requireHrAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isHrSpecialist: true, adminRole: true },
  });
  if (!user || (!user.isHrSpecialist && !user.adminRole)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  }
  req.isHrAdmin = !!user.adminRole;
  next();
}

function requireAssignedSpecialistOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.hrRequest) return res.status(401).json({ message: 'Authentication required.' });
  if (req.isHrAdmin || req.hrRequest.assignedSpecialistId === req.user.id) return next();
  return res.status(403).json({ message: 'This request is not assigned to you.' });
}

// ============================================================
// EMPLOYER-FACING
// ============================================================

// Price breakdown for the pre-purchase modal — vacancy owner only. Reads
// the vacancy's CURRENT applicant count (not yet snapshotted — that only
// happens at checkout, see routes/payments.ts's HR_SUPPORT branch).
router.get('/quote/:vacancyId', authenticate, requireApproved, async (req: Request, res: Response) => {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.vacancyId } });
  if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
  if (vacancy.postedById !== req.user!.id && req.user!.role !== 'SuperAdmin') {
    return res.status(404).json({ message: 'Vacancy not found.' });
  }
  const candidateCount = await prisma.vacancyApplication.count({ where: { vacancyId: vacancy.id } });
  const extraCandidates = Math.max(0, candidateCount - HR_INCLUDED_CANDIDATES);
  res.json({
    candidateCount,
    baseFee: HR_BASE_FEE,
    includedCandidates: HR_INCLUDED_CANDIDATES,
    extraCandidates,
    extraCandidateFee: HR_EXTRA_CANDIDATE_FEE,
    totalFee: calculateHRSupportFee(candidateCount),
    currency: 'GEL',
  });
});

// Must be registered before GET /:id, or a request to /mine would match
// :id="mine" — same ordering caveat as vacancies.ts's own /mine route.
router.get('/mine', authenticate, requireApproved, async (req: Request, res: Response) => {
  const requests = await prisma.hRSupportRequest.findMany({
    where: { requestedById: req.user!.id },
    include: {
      vacancy: { select: { id: true, title: true } },
      assignedSpecialist: specialistSelect,
      _count: { select: { candidateEvaluations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

router.get('/assigned-to-me', authenticate, requireApproved, requireHrAccess, async (req: Request, res: Response) => {
  const requests = await prisma.hRSupportRequest.findMany({
    where: req.isHrAdmin ? {} : { assignedSpecialistId: req.user!.id },
    include: {
      vacancy: { select: { id: true, title: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { candidateEvaluations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

router.get('/:id', authenticate, requireApproved, loadHRRequest, async (req: Request, res: Response) => {
  const isOwner = req.hrRequest!.requestedById === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  let isAssignedSpecialist = req.hrRequest!.assignedSpecialistId === req.user!.id;
  if (!isOwner && !isAdmin && !isAssignedSpecialist) {
    // Could still be a non-SuperAdmin admin-team member (MANAGER/MODERATOR)
    // or a genuine isHrSpecialist account that just isn't assigned to this
    // particular request — check the DB before rejecting outright.
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
    if (!user?.adminRole) return res.status(404).json({ message: 'HR Assistance request not found.' });
  }
  const full = await prisma.hRSupportRequest.findUnique({
    where: { id: req.hrRequest!.id },
    include: {
      vacancy: { select: { id: true, title: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      assignedSpecialist: specialistSelect,
      candidateEvaluations: { include: evaluationInclude, orderBy: [{ overallRank: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  res.json(full);
});

router.post(
  '/:id/confirm',
  authenticate,
  requireApproved,
  loadHRRequest,
  requireRequestOwnerOrAdmin,
  async (req: Request, res: Response) => {
    if (req.hrRequest!.status !== 'DELIVERED') {
      return res.status(400).json({ message: 'This request has not been delivered yet.' });
    }
    try {
      await releaseHRSupportEscrow(req.hrRequest!.id, 'CLIENT_CONFIRMED');
    } catch (err) {
      if (err instanceof HRSupportEscrowError) return res.status(400).json({ message: err.message });
      throw err;
    }
    const updated = await prisma.hRSupportRequest.findUnique({ where: { id: req.hrRequest!.id } });
    res.json(updated);
  }
);

router.post(
  '/:id/dispute',
  authenticate,
  requireApproved,
  loadHRRequest,
  requireRequestOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const result = disputeHRSupportRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    try {
      await flagHRSupportEscrowForReview(req.hrRequest!.id, result.data.reason);
    } catch (err) {
      if (err instanceof HRSupportEscrowError) return res.status(400).json({ message: err.message });
      throw err;
    }
    const updated = await prisma.hRSupportRequest.findUnique({ where: { id: req.hrRequest!.id } });
    res.json(updated);
  }
);

// ============================================================
// SPECIALIST-FACING (isHrSpecialist accounts, or an admin acting on their
// behalf — requireHrAccess + requireAssignedSpecialistOrAdmin together)
// ============================================================

router.put(
  '/:id/candidates/:evaluationId',
  authenticate,
  requireApproved,
  requireHrAccess,
  loadHRRequest,
  requireAssignedSpecialistOrAdmin,
  async (req: Request, res: Response) => {
    const result = updateCandidateEvaluationSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const evaluation = await prisma.candidateEvaluation.findFirst({
      where: { id: req.params.evaluationId, hrRequestId: req.hrRequest!.id },
    });
    if (!evaluation) return res.status(404).json({ message: 'Candidate evaluation not found.' });
    const { meetingUrl, ...rest } = result.data;
    const updated = await prisma.candidateEvaluation.update({
      where: { id: evaluation.id },
      data: { ...rest, ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }) },
      include: evaluationInclude,
    });
    res.json(updated);
  }
);

router.post(
  '/:id/deliver',
  authenticate,
  requireApproved,
  requireHrAccess,
  loadHRRequest,
  requireAssignedSpecialistOrAdmin,
  async (req: Request, res: Response) => {
    const result = deliverHRSupportRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    try {
      await markHRSupportDelivered(req.hrRequest!.id, result.data.reportSummary);
    } catch (err) {
      if (err instanceof HRSupportEscrowError) return res.status(400).json({ message: err.message });
      throw err;
    }
    const updated = await prisma.hRSupportRequest.findUnique({ where: { id: req.hrRequest!.id } });
    res.json(updated);
  }
);

export default router;
