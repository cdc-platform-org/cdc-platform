import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, optionalAuthenticate } from '../middleware/auth';
import { blogPostCreateSchema, blogPostUpdateSchema, blogCommentSchema } from '../schemas/blogSchemas';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
import { createUniqueBlogSlug } from '../services/blogSlugService';
import { processBlogCoverImage } from '../services/blogImageProcessing';

// Migrated from requireRole('SuperAdmin') to the admin-team adminRole system
// (SUPER_ADMIN + ADMIN) — content management is explicitly ADMIN's domain
// per the /admin panel's RBAC design, and this file's small/self-contained
// enough that migrating it doesn't carry the risk a wider sweep would.
const router = Router();
const authorSelect = { select: { id: true, name: true, role: true, avatarUrl: true } };

// Both list/detail routes are public (no `authenticate` requirement — the
// homepage feed and /blog pages call them anonymously) but must not leak
// draft content: only a logged-in SUPER_ADMIN/MANAGER (the admin/blog editor)
// gets unpublished posts. Skips the DB lookup entirely for the common case
// of an anonymous request (no bearer token at all).
async function canViewDrafts(req: Request): Promise<boolean> {
  if (!req.user) return false;
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { adminRole: true } });
  return user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'MANAGER';
}

router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const { category } = req.query;
  const includeDrafts = await canViewDrafts(req);
  const posts = await prisma.blogPost.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(includeDrafts ? {} : { published: true }),
    },
    include: { author: authorSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: posts });
});

// Accepts either the post's id (UUID, used by admin/blog's editor and old
// links) or its slug (the public /blog/[slug] page) — a single param that
// resolves either way keeps the route surface small.
router.get('/:idOrSlug', optionalAuthenticate, async (req: Request, res: Response) => {
  const includeDrafts = await canViewDrafts(req);
  const post = await prisma.blogPost.findFirst({
    where: {
      OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }],
      ...(includeDrafts ? {} : { published: true }),
    },
    include: { author: authorSelect },
  });
  if (!post) {
    return res.status(404).json({ message: 'Blog post not found.' });
  }
  res.json({ data: post });
});

router.post('/', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = blogPostCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const slug = await createUniqueBlogSlug(result.data.title);
  const post = await prisma.blogPost.create({
    data: {
      ...result.data,
      imageUrl: result.data.imageUrl || null,
      authorId: req.user!.id,
      slug,
    },
    include: { author: authorSelect },
  });
  res.status(201).json({ data: post });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = blogPostUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const nextImageUrl = result.data.imageUrl !== undefined ? result.data.imageUrl || null : undefined;
  try {
    // Read the pre-update imageUrl only when it's actually changing, so a
    // save that doesn't touch the image skips the extra query entirely.
    const previous =
      nextImageUrl !== undefined
        ? await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { imageUrl: true } })
        : null;

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        imageUrl: nextImageUrl,
      },
      include: { author: authorSelect },
    });

    if (previous && previous.imageUrl && previous.imageUrl !== nextImageUrl) {
      // Fire-and-forget — the response shouldn't wait on Bunny, and a
      // failed cleanup just leaves harmless orphaned storage debris.
      deleteManagedImage(previous.imageUrl).catch(() => {});
    }

    res.json({ data: post });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    throw err;
  }
});

router.delete('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.blogPost.delete({ where: { id: req.params.id }, select: { imageUrl: true } });
    if (deleted.imageUrl) {
      deleteManagedImage(deleted.imageUrl).catch(() => {});
    }
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    throw err;
  }
});

// ============================================================
// COMMENTS — one level deep (a top-level comment or a reply to one),
// authenticated platform users only. Public read (anyone can read
// comments on a public post), admin-only delete for moderation.
// ============================================================

const commentAuthorSelect = { select: { id: true, name: true, role: true, avatarUrl: true } };

router.get('/:idOrSlug/comments', optionalAuthenticate, async (req: Request, res: Response) => {
  const includeDrafts = await canViewDrafts(req);
  const post = await prisma.blogPost.findFirst({
    where: {
      OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }],
      ...(includeDrafts ? {} : { published: true }),
    },
    select: { id: true },
  });
  if (!post) return res.status(404).json({ message: 'Blog post not found.' });

  const comments = await prisma.blogComment.findMany({
    where: { postId: post.id },
    include: { author: commentAuthorSelect },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: comments });
});

router.post('/:idOrSlug/comments', authenticate, async (req: Request, res: Response) => {
  const result = blogCommentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const includeDrafts = await canViewDrafts(req);
  const post = await prisma.blogPost.findFirst({
    where: {
      OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }],
      ...(includeDrafts ? {} : { published: true }),
    },
    select: { id: true },
  });
  if (!post) return res.status(404).json({ message: 'Blog post not found.' });

  if (result.data.parentId) {
    const parent = await prisma.blogComment.findFirst({ where: { id: result.data.parentId, postId: post.id } });
    if (!parent) return res.status(400).json({ message: 'The comment being replied to was not found on this post.' });
    // Enforce the one-level-deep design (see the COMMENTS section comment
    // above) — without this, a direct API call could create a reply-to-a-
    // reply that the frontend's two-level rendering would never surface.
    if (parent.parentId) return res.status(400).json({ message: 'Replies can only be posted on top-level comments.' });
  }

  const comment = await prisma.blogComment.create({
    data: {
      postId: post.id,
      authorId: req.user!.id,
      content: result.data.content,
      parentId: result.data.parentId ?? null,
    },
    include: { author: commentAuthorSelect },
  });
  res.status(201).json({ data: comment });
});

// Moderation — admin-only delete. No edit/hide state; see the model's own
// comment for why deletion-only is enough here.
router.delete('/comments/:commentId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const comment = await prisma.blogComment.delete({ where: { id: req.params.commentId } }).catch(() => null);
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  res.status(204).send();
});

// --- Image upload: buffered in memory, then pushed straight to Bunny
// Storage — nothing ever touches this server's disk. Reused by both the
// blog editor and the CMS image pickers (homepage HEKS card, gallery). ---
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('მხოლოდ სურათის ატვირთვაა ნებადართული!'));
  }
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload-image',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next) => {
    imageUpload.single('image')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'ფოტოს ზომა აჭარბებს 10MB-ს. გთხოვთ, აირჩიოთ უფრო მცირე ზომის ფაილი.' });
      }
      return res.status(400).json({ message: err.message || 'მხოლოდ სურათის ატვირთვაა ნებადართული!' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'ფაილი არ არის არჩეული' });
    }
    const filename = `blog-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const processed = await processBlogCoverImage(req.file.buffer, req.file.mimetype);
      const url = await uploadImage({
        buffer: processed.buffer,
        mimetype: processed.mimetype,
        folderName: 'blog',
        filename,
      });
      res.status(201).json({ url });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
