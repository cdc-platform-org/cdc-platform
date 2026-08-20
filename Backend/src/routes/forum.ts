import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, requireApproved } from '../middleware/auth';
import { createThreadSchema, createCommentSchema } from '../schemas/forumSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { hasFreelancerRights } from '../utils/freelancerVerification';

const router = Router();

// Non-graduates may publish at most this many forum threads per calendar
// month (service offers / announcements share the same thread creation path,
// so one counter covers both) — CDC Verified Graduates are exempt entirely.
const NON_GRADUATE_MONTHLY_POST_LIMIT = 3;

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const authorSelect = { select: { id: true, name: true, role: true, isVerifiedGraduate: true } };

// Marketplace-role moderators (Mentor/SuperAdmin, the original community
// moderation capability) OR any admin-team member (adminRole set, the newer
// /admin/forum tier) — either is allowed to pin/lock/delete a thread.
async function canModerateForum(userId: string, marketplaceRole: string): Promise<boolean> {
  if (marketplaceRole === 'Mentor' || marketplaceRole === 'SuperAdmin') return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { adminRole: true } });
  return !!user?.adminRole;
}

function toThreadDTO(
  thread: {
    id: string;
    categoryId: string;
    title: string;
    content: string;
    author: { id: string; name: string; role: string; isVerifiedGraduate: boolean };
    isPinned: boolean;
    isLocked: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { comments: number; likes: number };
    likes: { userId: string }[];
  },
  currentUserId?: string
) {
  return {
    id: thread.id,
    categoryId: thread.categoryId,
    title: thread.title,
    content: thread.content,
    author: thread.author,
    likeCount: thread._count.likes,
    commentCount: thread._count.comments,
    isLikedByCurrentUser: !!currentUserId && thread.likes.some((l) => l.userId === currentUserId),
    isPinned: thread.isPinned,
    isLocked: thread.isLocked,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

// currentUserId is undefined for a guest — the likes filter then uses a
// sentinel that can never match a real user id, so the query still returns
// cheaply (no likes rows) instead of accidentally fetching every like.
const threadInclude = (currentUserId?: string) => ({
  author: authorSelect,
  _count: { select: { comments: true, likes: true } },
  likes: { where: { userId: currentUserId ?? '__guest__' }, select: { userId: true } },
});

// ============================================================
// CATEGORIES
// ============================================================
// Default categories, kept in sync with prisma/seed.ts's DEFAULT_FORUM_CATEGORIES
// by hand — duplicated (rather than imported) because seed.ts runs standalone
// via ts-node outside this project's rootDir and can't cleanly import from src.
const DEFAULT_FORUM_CATEGORIES = [
  { slug: 'general', name: 'ზოგადი დისკუსია', description: 'ზოგადი თემები და საუბრები საზოგადოებისთვის.' },
  { slug: 'courses', name: 'კურსები და სწავლება', description: 'კითხვები და გამოცდილება კურსების შესახებ.' },
  { slug: 'freelance', name: 'ფრილანსი და პროექტები', description: 'გიგების, ვაკანსიების და პროექტების განხილვა.' },
  { slug: 'help', name: 'დახმარება და მხარდაჭერა', description: 'ტექნიკური თუ ორგანიზაციული საკითხები პლატფორმაზე.' },
];

// Public — the /forum index page lists categories for signed-out visitors
// too (only posting/replying requires an approved account), so this must
// not sit behind authenticate().
router.get('/categories', async (_req: Request, res: Response) => {
  const existingCount = await prisma.forumCategory.count();
  if (existingCount === 0) {
    // A production DB that never had `prisma db seed` run against it would
    // otherwise show an empty/broken /forum page forever — self-heal here
    // instead of depending on a manual seed step.
    await Promise.all(
      DEFAULT_FORUM_CATEGORIES.map((c) =>
        prisma.forumCategory.upsert({ where: { slug: c.slug }, update: {}, create: c }).catch(() => null)
      )
    );
  }

  const categories = await prisma.forumCategory.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { threads: { where: { moderationStatus: 'APPROVED' } } } } },
  });
  res.json(
    categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      threadCount: c._count.threads,
      createdAt: c.createdAt,
    }))
  );
});

// Everything below is readable by anyone (guests included) — only
// mutations (post/comment/like/moderate) require a signed-in account, each
// enforced at the individual route via requireApproved/authenticate.
router.use(optionalAuthenticate);

// ============================================================
// THREADS
// ============================================================

// A guest-visible thread is APPROVED; a signed-in user also sees their own
// PENDING/REJECTED threads; an admin-team member sees everything.
async function visibleThreadWhere(userId?: string) {
  if (!userId) return { moderationStatus: 'APPROVED' as const };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { adminRole: true } });
  if (user?.adminRole) return {};
  return { OR: [{ moderationStatus: 'APPROVED' as const }, { authorId: userId }] };
}

router.get('/threads', async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;

  const visibility = await visibleThreadWhere(req.user?.id);
  const where = { ...visibility, ...(categoryId ? { categoryId } : {}) };

  const [threads, totalCount] = await Promise.all([
    prisma.forumThread.findMany({
      where,
      include: threadInclude(req.user?.id),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.forumThread.count({ where }),
  ]);

  res.json({ items: threads.map((t) => toThreadDTO(t, req.user?.id)), totalCount, page, pageSize });
});

router.get('/threads/:id', async (req: Request, res: Response) => {
  const thread = await prisma.forumThread.findUnique({
    where: { id: req.params.id },
    include: threadInclude(req.user?.id),
  });
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });

  if (thread.moderationStatus !== 'APPROVED' && thread.authorId !== req.user?.id) {
    const user = req.user ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { adminRole: true } }) : null;
    if (!user?.adminRole) return res.status(404).json({ message: 'Thread not found.' });
  }
  res.json(toThreadDTO(thread, req.user?.id));
});

// Remaining monthly post quota for the caller — CDC Verified Graduates have
// no limit; everyone else is capped at NON_GRADUATE_MONTHLY_POST_LIMIT new
// threads per calendar month (used/shown by the dashboard's post counter).
router.get('/quota', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { isVerifiedGraduate: true, verificationLevel: true, verificationStatus: true },
  });
  if (user && hasFreelancerRights(user)) {
    return res.json({ isGraduate: true, limit: null, used: null, remaining: null });
  }
  const used = await prisma.forumThread.count({
    where: { authorId: req.user!.id, createdAt: { gte: startOfCurrentMonth() } },
  });
  res.json({
    isGraduate: false,
    limit: NON_GRADUATE_MONTHLY_POST_LIMIT,
    used,
    remaining: Math.max(0, NON_GRADUATE_MONTHLY_POST_LIMIT - used),
  });
});

router.post('/threads', requireApproved, async (req: Request, res: Response) => {
  const result = createThreadSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const category = await prisma.forumCategory.findUnique({ where: { id: result.data.categoryId } });
  if (!category) return res.status(404).json({ message: 'Category not found.' });

  const author = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { isVerifiedGraduate: true, verificationLevel: true, verificationStatus: true },
  });
  if (!author || !hasFreelancerRights(author)) {
    const postsThisMonth = await prisma.forumThread.count({
      where: { authorId: req.user!.id, createdAt: { gte: startOfCurrentMonth() } },
    });
    if (postsThisMonth >= NON_GRADUATE_MONTHLY_POST_LIMIT) {
      return res.status(403).json({
        message: `ამ თვეს პოსტების ლიმიტს (${NON_GRADUATE_MONTHLY_POST_LIMIT}) მიაღწიეთ. CDC-ის კურსდამთავრებულებს პოსტების ლიმიტი არ აქვთ.`,
      });
    }
  }

  const { sanitized: content } = sanitizeChatMessage(result.data.content);

  const thread = await prisma.forumThread.create({
    data: {
      categoryId: category.id,
      authorId: req.user!.id,
      title: result.data.title,
      content,
      // moderationStatus defaults to PENDING — new posts require approval.
    },
    include: threadInclude(req.user!.id),
  });
  res.status(201).json(toThreadDTO(thread, req.user!.id));
});

router.post('/threads/:id/like', requireApproved, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  await prisma.forumThreadLike.upsert({
    where: { threadId_userId: { threadId: thread.id, userId: req.user!.id } },
    update: {},
    create: { threadId: thread.id, userId: req.user!.id },
  });
  const updated = await prisma.forumThread.findUniqueOrThrow({
    where: { id: thread.id },
    include: threadInclude(req.user!.id),
  });
  res.json(toThreadDTO(updated, req.user!.id));
});

router.delete('/threads/:id/like', requireApproved, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  await prisma.forumThreadLike
    .delete({ where: { threadId_userId: { threadId: thread.id, userId: req.user!.id } } })
    .catch(() => {});
  const updated = await prisma.forumThread.findUniqueOrThrow({
    where: { id: thread.id },
    include: threadInclude(req.user!.id),
  });
  res.json(toThreadDTO(updated, req.user!.id));
});

// ---- Moderation: pin / lock / delete (Mentor, SuperAdmin, or any admin-team member) ----

async function requireForumModerator(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !(await canModerateForum(req.user.id, req.user.role))) {
    return res.status(403).json({ message: 'You do not have permission to moderate the forum.' });
  }
  next();
}

router.post('/threads/:id/pin', requireForumModerator, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread
    .update({ where: { id: req.params.id }, data: { isPinned: true }, include: threadInclude(req.user!.id) })
    .catch(() => null);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  res.json(toThreadDTO(thread, req.user!.id));
});

router.delete('/threads/:id/pin', requireForumModerator, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread
    .update({ where: { id: req.params.id }, data: { isPinned: false }, include: threadInclude(req.user!.id) })
    .catch(() => null);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  res.json(toThreadDTO(thread, req.user!.id));
});

router.post('/threads/:id/lock', requireForumModerator, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread
    .update({ where: { id: req.params.id }, data: { isLocked: true }, include: threadInclude(req.user!.id) })
    .catch(() => null);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  res.json(toThreadDTO(thread, req.user!.id));
});

router.delete('/threads/:id/lock', requireForumModerator, async (req: Request, res: Response) => {
  const thread = await prisma.forumThread
    .update({ where: { id: req.params.id }, data: { isLocked: false }, include: threadInclude(req.user!.id) })
    .catch(() => null);
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  res.json(toThreadDTO(thread, req.user!.id));
});

router.delete('/threads/:id', requireForumModerator, async (req: Request, res: Response) => {
  await prisma.forumThread.delete({ where: { id: req.params.id } }).catch(() => {});
  res.status(204).send();
});

// ============================================================
// COMMENTS
// ============================================================

function toCommentDTO(comment: {
  id: string;
  threadId: string;
  content: string;
  author: { id: string; name: string; role: string; isVerifiedGraduate: boolean };
  createdAt: Date;
  _count: { likes: number };
  likes: { userId: string }[];
}, currentUserId?: string) {
  return {
    id: comment.id,
    threadId: comment.threadId,
    content: comment.content,
    author: comment.author,
    likeCount: comment._count.likes,
    isLikedByCurrentUser: !!currentUserId && comment.likes.some((l) => l.userId === currentUserId),
    createdAt: comment.createdAt,
  };
}

const commentInclude = (currentUserId?: string) => ({
  author: authorSelect,
  _count: { select: { likes: true } },
  likes: { where: { userId: currentUserId ?? '__guest__' }, select: { userId: true } },
});

router.get('/threads/:id/comments', async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));

  const [comments, totalCount] = await Promise.all([
    prisma.forumComment.findMany({
      where: { threadId: req.params.id },
      include: commentInclude(req.user?.id),
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.forumComment.count({ where: { threadId: req.params.id } }),
  ]);
  res.json({ items: comments.map((c) => toCommentDTO(c, req.user?.id)), totalCount, page, pageSize });
});

router.post('/threads/:id/comments', requireApproved, async (req: Request, res: Response) => {
  const result = createCommentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ message: 'Thread not found.' });
  if (thread.isLocked) return res.status(400).json({ message: 'This thread is locked.' });

  const { sanitized: content } = sanitizeChatMessage(result.data.content);

  const comment = await prisma.forumComment.create({
    data: { threadId: thread.id, authorId: req.user!.id, content },
    include: commentInclude(req.user!.id),
  });
  res.status(201).json(toCommentDTO(comment, req.user!.id));
});

router.post('/comments/:id/like', requireApproved, async (req: Request, res: Response) => {
  const comment = await prisma.forumComment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  await prisma.forumCommentLike.upsert({
    where: { commentId_userId: { commentId: comment.id, userId: req.user!.id } },
    update: {},
    create: { commentId: comment.id, userId: req.user!.id },
  });
  const updated = await prisma.forumComment.findUniqueOrThrow({
    where: { id: comment.id },
    include: commentInclude(req.user!.id),
  });
  res.json(toCommentDTO(updated, req.user!.id));
});

router.delete('/comments/:id/like', requireApproved, async (req: Request, res: Response) => {
  const comment = await prisma.forumComment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  await prisma.forumCommentLike
    .delete({ where: { commentId_userId: { commentId: comment.id, userId: req.user!.id } } })
    .catch(() => {});
  const updated = await prisma.forumComment.findUniqueOrThrow({
    where: { id: comment.id },
    include: commentInclude(req.user!.id),
  });
  res.json(toCommentDTO(updated, req.user!.id));
});

router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  const comment = await prisma.forumComment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ message: 'Comment not found.' });
  const isOwner = comment.authorId === req.user!.id;
  const isModerator = await canModerateForum(req.user!.id, req.user!.role);
  if (!isOwner && !isModerator) {
    return res.status(403).json({ message: 'You do not have permission to delete this comment.' });
  }
  await prisma.forumComment.delete({ where: { id: comment.id } });
  res.status(204).send();
});

export default router;
