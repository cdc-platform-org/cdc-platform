/**
 * Enrolled-only course discussion (Q&A) on the /learn player, with AI
 * content-safety checks before a post is stored.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { checkContentSafety } from '../../services/contentModerationService';
import { courseDiscussionPostCreateSchema } from '../../schemas/courseSchemas';
import { requireCourseAccess } from './shared';

const router = Router();

// ============================================================
// COURSE DISCUSSION — enrolled-only Q&A on the /learn player (same access
// check as curriculum, requireCourseAccess). One level of replies; every
// post is AI-safety-checked before it's ever stored — see
// contentModerationService.checkContentSafety.
// ============================================================
router.get('/:courseId/discussion', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const posts = await prisma.courseDiscussionPost.findMany({
    where: { courseId: req.params.courseId, parentId: null },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      replies: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: posts });
});

// IP-keyed, same shape/reasoning as ai.ts's courseTutorRateLimit — a
// Gemini-backed create endpoint is the obvious abuse target for burning
// quota (or for spamming the discussion itself).
const discussionPostRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many posts. Please wait a moment before posting again.',
});

router.post(
  '/:courseId/discussion',
  authenticate,
  requireCourseAccess,
  discussionPostRateLimit,
  async (req: Request, res: Response) => {
    const result = courseDiscussionPostCreateSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });

    if (result.data.parentId) {
      const parent = await prisma.courseDiscussionPost.findUnique({
        where: { id: result.data.parentId },
        select: { courseId: true, parentId: true },
      });
      if (!parent || parent.courseId !== req.params.courseId) {
        return res.status(400).json({ message: 'Invalid parent post.' });
      }
      if (parent.parentId) {
        return res.status(400).json({ message: 'Replies can only be one level deep.' });
      }
    }

    const { safe } = await checkContentSafety(result.data.content);
    if (!safe) {
      return res.status(400).json({ message: 'პოსტი შეიცავს არასათანადო/შეურაცხმყოფელ ენას და ვერ გამოქვეყნდება.' });
    }

    const post = await prisma.courseDiscussionPost.create({
      data: {
        courseId: req.params.courseId,
        authorId: req.user!.id,
        content: result.data.content,
        parentId: result.data.parentId ?? null,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json({ data: post });
  }
);

// Admin backstop — checkContentSafety fails OPEN when Gemini is unavailable,
// so this is what actually removes anything that slips through in that
// window, same role human moderation already plays for the site-wide
// forum's approved-after-the-fact comments.
router.delete('/discussion/:postId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    await prisma.courseDiscussionPost.delete({ where: { id: req.params.postId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Post not found.' });
    throw err;
  }
});

export default router;
