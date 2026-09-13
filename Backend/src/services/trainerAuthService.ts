import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// ============================================================
// IAKO Trainer Tools — server-side authorization helpers.
//
// Every trainer-facing route MUST go through requireTrainerProfile (an
// authenticated user with an active TrainerProfile) and, for anything
// scoped to one specific cohort, requireAssignedTraining (an active
// assignment linking that TrainerProfile to that LiveTraining). Frontend
// hiding is never sufficient on its own — see the IDOR test suite in
// __tests__/trainerWorkspace.test.ts for the exact cross-trainer scenarios
// this exists to prevent.
// ============================================================

export class TrainerAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Express augmentation for the trainer's own profile id, set once by
// requireTrainer below — same "resolve once, read many times" convention as
// req.adminRole in middleware/auth.ts.
declare global {
  namespace Express {
    interface Request {
      trainerProfileId?: string;
    }
  }
}

export async function requireTrainerProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId } });
  if (!profile || !profile.active) {
    throw new TrainerAccessError(403, 'You do not have an active Trainer profile.');
  }
  return profile;
}

// Express middleware form of the above, for mounting on a router the same
// way requireAdminRole(...) is used in adminLiveTrainings.ts. Must run after
// authenticate() (needs req.user).
export async function requireTrainer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const profile = await requireTrainerProfile(req.user.id);
    req.trainerProfileId = profile.id;
    next();
  } catch (err) {
    if (err instanceof TrainerAccessError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
}

// Loads the assignment linking this trainer to this specific training —
// 404 (not 403) when absent, same "don't confirm the training exists to a
// caller with no right to know" posture as instructorCourses.ts's
// requireOwnedCourse. This is the one check every per-training trainer
// route must call before reading or writing anything scoped to that id.
export async function requireAssignedTraining(trainerProfileId: string, liveTrainingId: string) {
  const assignment = await prisma.liveTrainingTrainerAssignment.findUnique({
    where: { trainerProfileId_liveTrainingId: { trainerProfileId, liveTrainingId } },
  });
  if (!assignment) throw new TrainerAccessError(404, 'Live training not found.');
  return assignment;
}
