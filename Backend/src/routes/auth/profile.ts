/**
 * The signed-in user's profile: GET /me, terms acceptance, avatar and CV uploads.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { BunnyStorageUploadError } from '../../services/integrations/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../../services/integrations/imageStorage';
import { toUserResponse } from './shared';

const router = Router();

// ============================================================
// PROFILE — legal identity fields (dashboard/settings), separate from the
// admin-facing user management in routes/admin.ts.
// ============================================================

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'Account no longer exists.' });
  res.json({ user: toUserResponse(user) });
});

// Explicit consent action — the frontend's blocking first-login modal (shown
// to any authenticated user with termsAcceptedAt still null: pre-existing
// accounts and every Google sign-up, which has no separate consent step
// before account creation) calls this once the user clicks "I agree".
// Idempotent: a second call just re-confirms rather than erroring.
router.post('/accept-terms', authenticate, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { termsAcceptedAt: new Date() },
  });
  res.json({ user: toUserResponse(user) });
});

// Self-serve avatar upload — any authenticated user, buffered in memory then
// pushed straight to Bunny Storage (no local disk write). Deliberately its
// own endpoint rather than a freely-settable field on PUT /me: this way the
// server always computes the URL from an actual uploaded file, so a user's
// public-facing avatar can never be pointed at an arbitrary external URL.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image uploads are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/me/avatar',
  authenticate,
  (req: Request, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } });

    const filename = `avatar-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'avatars',
        filename,
      });
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: url } });

      if (previous?.avatarUrl && previous.avatarUrl !== url) {
        deleteManagedImage(previous.avatarUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Avatar upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Self-serve CV/résumé upload — any authenticated user (freelancers
// attaching one to a gig/vacancy application, mentors, anyone). Same
// buffered-then-Bunny-Storage flow as the avatar upload above, and same
// "own endpoint rather than a freely-settable field" reasoning: the URL is
// only ever the server's own upload, never an arbitrary pasted link. This
// is the same User.cvUrl field the admin-only mentor CV upload
// (routes/adminMentorship.ts) writes to — one field, two upload paths.
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
  '/me/cv',
  authenticate,
  (req: Request, res: Response, next) => {
    cvUpload.single('cv')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The file exceeds 15MB.' });
      }
      return res.status(400).json({ message: err.message || 'Only PDF or DOCX files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { cvUrl: true } });

    const filename = `cv-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname) || '.pdf'}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'user-cvs',
        filename,
      });
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { cvUrl: url } });

      if (previous?.cvUrl && previous.cvUrl !== url) {
        deleteManagedImage(previous.cvUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'CV upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
