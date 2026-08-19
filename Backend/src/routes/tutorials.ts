import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, optionalAuthenticate } from '../middleware/auth';
import { tutorialCreateSchema, tutorialUpdateSchema } from '../schemas/tutorialSchemas';
import { autoTranslateIfBlank } from '../services/aiTranslateService';

// Same shape as routes/blog.ts: one router, public read + admin-gated
// write, rather than a separate /api/admin/tutorials CRUD router — mirrors
// how this codebase's other admin-authored public content (blog, studio
// cases, success stories) is organized.
const router = Router();

// Both list/detail routes are public (no `authenticate` requirement — the
// /tutorials page calls them anonymously) but must not leak drafts: only a
// logged-in SUPER_ADMIN/MANAGER (the admin/tutorials editor) sees
// unpublished tutorials. Skips the DB lookup entirely for the common case
// of an anonymous request (no bearer token at all).
async function canViewDrafts(req: Request): Promise<boolean> {
  if (!req.user) return false;
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { adminRole: true } });
  return user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'MANAGER';
}

router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const { category } = req.query;
  const includeDrafts = await canViewDrafts(req);
  const tutorials = await prisma.tutorial.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(includeDrafts ? {} : { publishedAt: { not: null } }),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ data: tutorials });
});

router.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const includeDrafts = await canViewDrafts(req);
  const tutorial = await prisma.tutorial.findFirst({
    where: { id: req.params.id, ...(includeDrafts ? {} : { publishedAt: { not: null } }) },
  });
  if (!tutorial) return res.status(404).json({ message: 'Tutorial not found.' });
  res.json({ data: tutorial });
});

router.post('/', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = tutorialCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { published, ...data } = result.data;
  const { titleEn, descriptionEn } = await autoTranslateIfBlank(
    data.title,
    data.description,
    data.titleEn,
    data.descriptionEn,
    'tutorials'
  );
  const tutorial = await prisma.tutorial.create({
    data: { ...data, titleEn, descriptionEn, publishedAt: published ? new Date() : null },
  });
  res.status(201).json({ data: tutorial });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = tutorialUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { published, ...data } = result.data;
  try {
    const existing = await prisma.tutorial.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Tutorial not found.' });

    // Only touch publishedAt when the request actually includes `published`
    // — an edit that doesn't touch the publish toggle shouldn't bump the
    // "recently added" sort timestamp. Re-publishing keeps the original
    // publishedAt rather than resetting it, same reasoning.
    let publishedAt: Date | null | undefined;
    if (published !== undefined) {
      publishedAt = published ? (existing.publishedAt ?? new Date()) : null;
    }

    const { titleEn, descriptionEn } = await autoTranslateIfBlank(
      data.title ?? existing.title,
      data.description ?? existing.description,
      data.titleEn !== undefined ? data.titleEn : existing.titleEn,
      data.descriptionEn !== undefined ? data.descriptionEn : existing.descriptionEn,
      'tutorials'
    );

    const tutorial = await prisma.tutorial.update({
      where: { id: req.params.id },
      data: { ...data, titleEn, descriptionEn, ...(publishedAt !== undefined ? { publishedAt } : {}) },
    });
    res.json({ data: tutorial });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Tutorial not found.' });
    }
    throw err;
  }
});

router.delete('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    await prisma.tutorial.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Tutorial not found.' });
    }
    throw err;
  }
});

export default router;
