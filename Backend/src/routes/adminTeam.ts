import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { teamMemberCreateSchema, teamMemberUpdateSchema } from '../schemas/teamMemberSchemas';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  const members = await prisma.teamMember.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  res.json({ data: members });
});

router.post('/', async (req: Request, res: Response) => {
  const result = teamMemberCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { bio, imageUrl, ...rest } = result.data;
  const member = await prisma.teamMember.create({
    data: { ...rest, bio: bio || null, imageUrl: imageUrl || null },
  });
  await logAdminAction({ action: 'team-member.create', targetType: 'TeamMember', targetId: member.id, performedById: req.user!.id });
  res.status(201).json({ data: member });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = teamMemberUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { bio, imageUrl, ...rest } = result.data;
  try {
    // Read the pre-update imageUrl only when it's actually changing, so a
    // save that doesn't touch the photo skips the extra query entirely —
    // same pattern as adminSuccessStories.ts's PUT /:id.
    const previous =
      imageUrl !== undefined
        ? await prisma.teamMember.findUnique({ where: { id: req.params.id }, select: { imageUrl: true } })
        : null;

    const member = await prisma.teamMember.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(bio !== undefined && { bio: bio || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      },
    });

    if (previous && previous.imageUrl && previous.imageUrl !== (imageUrl || null)) {
      deleteManagedImage(previous.imageUrl).catch(() => {});
    }

    await logAdminAction({ action: 'team-member.update', targetType: 'TeamMember', targetId: member.id, performedById: req.user!.id });
    res.json({ data: member });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Team member not found.' });
    throw err;
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const member = await prisma.teamMember.delete({ where: { id: req.params.id } });
    if (member.imageUrl) deleteManagedImage(member.imageUrl).catch(() => {});

    await logAdminAction({ action: 'team-member.delete', targetType: 'TeamMember', targetId: member.id, performedById: req.user!.id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Team member not found.' });
    throw err;
  }
});

// --- Photo upload: same buffered-straight-to-Bunny pattern as
// adminSuccessStories.ts's /upload-avatar, own storage folder ("team"). ---
const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload-photo',
  (req: Request, res: Response, next) => {
    photoUpload.single('photo')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `team-member-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'team',
        filename,
      });
      res.status(201).json({ url });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Photo upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
