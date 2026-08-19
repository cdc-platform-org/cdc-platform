import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { mentorAvailabilityRuleSchema, mentorProfileSchema, attachRecordingSchema } from '../schemas/adminSchemas';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { attachMentorshipRecording, MentorshipRecordingError } from '../services/mentorshipRecordingService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const userSelect = { select: { id: true, name: true, email: true } };

// Gigs where the assigned freelancer clicked "Request CDC Mentor Help",
// still in progress (not yet completed/cancelled).
router.get('/queue', async (_req: Request, res: Response) => {
  const gigs = await prisma.gig.findMany({
    where: { mentorHelpRequestedAt: { not: null }, status: { in: ['assigned', 'submitted'] } },
    include: { postedBy: userSelect, assignedFreelancer: userSelect },
    orderBy: { mentorHelpRequestedAt: 'desc' },
  });

  // First-order flag, computed the same way as GET /gigs/:id.
  const withFirstOrder = await Promise.all(
    gigs.map(async (gig) => {
      const priorCompletedCount = gig.assignedFreelancerId
        ? await prisma.gig.count({
            where: { assignedFreelancerId: gig.assignedFreelancerId, status: 'completed', id: { not: gig.id } },
          })
        : 0;
      return { ...gig, isFirstOrder: priorCompletedCount === 0 };
    })
  );

  res.json({ data: withFirstOrder });
});

// Full submission draft, for a mentor/admin to review and guide the
// student before final delivery.
router.get('/gigs/:id', async (req: Request, res: Response) => {
  const gig = await prisma.gig.findUnique({
    where: { id: req.params.id },
    include: { postedBy: userSelect, assignedFreelancer: userSelect },
  });
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  res.json({ data: gig });
});

router.post('/gigs/:id/dismiss', async (req: Request, res: Response) => {
  const gig = await prisma.gig
    .update({ where: { id: req.params.id }, data: { mentorHelpRequestedAt: null } })
    .catch(() => null);
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  res.json({ data: gig });
});

// General "დახმარება / მენტორობა" requests from the Dashboard button — not
// tied to any specific gig, see MentorshipRequest's schema comment.
router.get('/requests', async (_req: Request, res: Response) => {
  const requests = await prisma.mentorshipRequest.findMany({
    where: { status: 'OPEN' },
    include: { user: userSelect },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: requests });
});

router.post('/requests/:id/resolve', async (req: Request, res: Response) => {
  const request = await prisma.mentorshipRequest
    .update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: req.user!.id },
    })
    .catch(() => null);
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  res.json({ data: request });
});

// ============================================================
// MENTOR AVAILABILITY & CALENDAR BOOKINGS — recurring weekly rules an admin
// sets per mentor (e.g. "Tuesdays 18:00-22:00"), enforced server-side at
// checkout by mentorAvailabilityService.assertSlotAvailable(). Distinct from
// the free-help-request queue above.
// ============================================================
const mentorProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  bioEn: true,
  mentorTitle: true,
  mentorTitleEn: true,
  mentorHourlyRate: true,
  mentorSkills: true,
  mentorLanguages: true,
  cvUrl: true,
  mentorPublished: true,
} as const;

router.get('/mentors', async (_req: Request, res: Response) => {
  const mentors = await prisma.user.findMany({
    where: { role: 'Mentor' },
    select: mentorProfileSelect,
    orderBy: { name: 'asc' },
  });
  res.json({ data: mentors });
});

// Promotes an existing Student/Client account to Mentor — there was
// previously no in-app way to do this at all (mentor accounts were only
// ever set directly in the database), so the Mentor Dashboard and every
// other mentor-only route in this codebase was unreachable in practice for
// a newly-recruited mentor. SUPER_ADMIN|MANAGER (same tier as the demote
// endpoint below, and as the badge/ban actions on routes/admin.ts) —
// previously SUPER_ADMIN-only, widened so the promote/demote toggle in
// User Management has one consistent permission in both directions.
router.post('/mentors/promote', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : null;
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'Mentor') return res.status(400).json({ message: 'This user is already a Mentor.' });
  if (user.role === 'SuperAdmin') return res.status(400).json({ message: 'Cannot change a SuperAdmin\'s role.' });

  const updated = await prisma.user.update({
    where: { id: userId },
    // Remember what they were so a later demote can put them back —
    // role itself is about to be overwritten and has no history of its own.
    data: { role: 'Mentor', preMentorRole: user.role },
    select: mentorProfileSelect,
  });
  res.status(200).json({ data: updated });
});

// Reverses promote above — used by the User Management "remove Mentor
// status" toggle. Reverts to whichever of Student/Client the account was
// before promotion (preMentorRole), falling back to Student for a Mentor
// promoted before that field existed. Deliberately doesn't touch the
// mentorTitle/bio/cvUrl/etc. profile fields or past MentorshipBooking rows —
// those stay in place (harmless while role isn't Mentor) so a later
// re-promotion doesn't lose the mentor's old profile, and booking history
// is never something a role toggle should delete.
router.post('/mentors/:userId/demote', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role !== 'Mentor') return res.status(400).json({ message: 'This user is not a Mentor.' });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: user.preMentorRole ?? 'Student', preMentorRole: null },
    select: { id: true, name: true, email: true, role: true },
  });
  res.status(200).json({ data: updated });
});

router.put('/mentors/:mentorId/profile', async (req: Request, res: Response) => {
  const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
  if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

  const result = mentorProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const updated = await prisma.user.update({
    where: { id: mentor.id },
    data: result.data,
    select: mentorProfileSelect,
  });
  res.json({ data: updated });
});

// CV/résumé — PDF or DOCX only, uploaded to Bunny Storage via the same
// generic uploadImage() wrapper the digital-store product files use
// (despite the name, it's not image-specific — see imageStorage.ts).
const CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const cvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (CV_MIME_TYPES.includes(file.mimetype) || /\.(pdf|docx?)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF or DOCX files are allowed.'));
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — plenty for a CV
});

router.post(
  '/mentors/:mentorId/cv',
  (req: Request, res: Response, next: NextFunction) => {
    cvUpload.single('cv')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The file exceeds 15MB.' });
      }
      return res.status(400).json({ message: err.message || 'Only PDF or DOCX files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
    if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

    const filename = `cv-${mentor.id}-${Date.now()}${path.extname(req.file.originalname) || '.pdf'}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'mentor-cvs',
        filename,
      });
      const updated = await prisma.user.update({
        where: { id: mentor.id },
        data: { cvUrl: url },
        select: mentorProfileSelect,
      });
      res.status(201).json({ data: updated });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'CV upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Avatar/profile photo — PNG or JPG only, same Bunny Storage flow as the
// CV upload above and the digital-store product cover images
// (services/imageStorage.ts). Same field the mentor's own self-service
// /dashboard/settings avatar upload writes to (User.avatarUrl) — an admin
// setting it here just overwrites whatever's already there.
const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (AVATAR_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG or JPG images are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, same ceiling as other image uploads
});

router.post(
  '/mentors/:mentorId/avatar',
  (req: Request, res: Response, next: NextFunction) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The image exceeds 10MB.' });
      }
      return res.status(400).json({ message: err.message || 'Only PNG or JPG images are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
    if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

    const filename = `avatar-${mentor.id}-${Date.now()}${path.extname(req.file.originalname) || '.jpg'}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'mentor-avatars',
        filename,
      });
      const updated = await prisma.user.update({
        where: { id: mentor.id },
        data: { avatarUrl: url },
        select: mentorProfileSelect,
      });
      res.status(201).json({ data: updated });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Avatar upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.get('/mentors/:mentorId/availability', async (req: Request, res: Response) => {
  const rules = await prisma.mentorAvailabilityRule.findMany({
    where: { mentorId: req.params.mentorId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
  res.json({ data: rules });
});

router.post('/mentors/:mentorId/availability', async (req: Request, res: Response) => {
  const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
  if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const rule = await prisma.mentorAvailabilityRule.create({
    data: { mentorId: mentor.id, ...result.data },
  });
  res.status(201).json({ data: rule });
});

router.put('/availability/:ruleId', async (req: Request, res: Response) => {
  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const rule = await prisma.mentorAvailabilityRule
    .update({ where: { id: req.params.ruleId }, data: result.data })
    .catch(() => null);
  if (!rule) return res.status(404).json({ message: 'Availability rule not found.' });
  res.json({ data: rule });
});

router.delete('/availability/:ruleId', async (req: Request, res: Response) => {
  await prisma.mentorAvailabilityRule.delete({ where: { id: req.params.ruleId } }).catch(() => null);
  res.status(204).send();
});

// ============================================================
// BOOKINGS — every paid mentorship session, for the admin panel's
// "ბუკინგები" tab. Loads current data on each visit (this codebase has no
// websocket/push infrastructure anywhere; a real-time push feed would be
// new architecture, not a small addition — the frontend just refetches on
// mount/manual refresh, same pattern as every other admin list page).
// ============================================================
router.get('/bookings', async (_req: Request, res: Response) => {
  const bookings = await prisma.mentorshipBooking.findMany({
    include: {
      mentor: userSelect,
      student: userSelect,
      bogPayment: { select: { status: true, amount: true, currency: true } },
      stripePayment: { select: { status: true, amount: true, currency: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  });
  res.json({ data: bookings });
});

// Attach/replace a pasted recording link — emails the student once, the
// first time a link is set (see mentorshipRecordingService.ts).
router.patch('/bookings/:id/recording', async (req: Request, res: Response) => {
  const result = attachRecordingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const updated = await attachMentorshipRecording(req.params.id, result.data.recordingUrl);
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof MentorshipRecordingError) return res.status(404).json({ message: err.message });
    throw err;
  }
});

export default router;
