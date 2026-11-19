/**
 * Express router mounted at `/api/admin/marketing-planner` (see server.ts).
 * The AI marketing planner's admin API — logic in services/marketingPlanner/.
 * Endpoints:
 *   GET    /overview?week=ISO           settings, status, the week's posts
 *   PUT    /settings
 *   POST   /plan            { week?, replaceDrafts? }   start planning (202)
 *   PATCH  /posts/:id       { caption?, hashtags?, scheduledAt? }
 *   POST   /posts/:id/rewrite   { feedback? }
 *   POST   /posts/:id/approve
 *   POST   /posts/:id/reject    { reason? }
 *   POST   /posts/:id/published
 *   POST   /posts/:id/unapprove
 *   DELETE /posts/:id
 * Nothing here posts to Facebook/Instagram (stage 1).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import {
  composeCaption,
  getPlannerSettings,
  nextWeekStart,
  planWeekPosts,
  plannerStatus,
  PlannerError,
  rewritePost,
  settingsUpdateSchema,
  updatePlannerSettings,
  weekStartTbilisi,
} from '../../services/marketingPlanner';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

type PostRow = Awaited<ReturnType<typeof prisma.marketingPost.findFirstOrThrow>>;
const view = (p: PostRow & { product?: { id: string; title: string } | null }) => ({
  ...p,
  fullText: composeCaption(p.platform as 'FACEBOOK' | 'INSTAGRAM', p.caption, p.hashtags, p.productUrl),
});

function handle(res: Response, err: unknown) {
  if (err instanceof PlannerError) return res.status(err.status).json({ message: err.message });
  throw err;
}

const weekQuery = z.object({ week: z.string().datetime().optional() });

router.get('/overview', async (req: Request, res: Response) => {
  const q = weekQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ errors: q.error.errors });
  const week = q.data.week ? weekStartTbilisi(new Date(q.data.week)) : nextWeekStart();
  const posts = await prisma.marketingPost.findMany({
    where: { weekStart: week },
    include: { product: { select: { id: true, title: true } } },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({
    data: { week: week.toISOString(), settings: await getPlannerSettings(), status: plannerStatus(), posts: posts.map(view) },
  });
});

router.put('/settings', async (req: Request, res: Response) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  res.json({ data: await updatePlannerSettings(parsed.data) });
});

const planSchema = z.object({ week: z.string().datetime().optional(), replaceDrafts: z.boolean().optional().default(false) });

router.post('/plan', async (req: Request, res: Response) => {
  const parsed = planSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  const week = parsed.data.week ? weekStartTbilisi(new Date(parsed.data.week)) : nextWeekStart();
  // Planning a week that is already over makes no sense.
  if (week.getTime() + 7 * 86_400_000 < Date.now()) return res.status(400).json({ message: 'That week is already over.' });
  try {
    // Fire and forget; errors land in plannerStatus().lastError.
    void planWeekPosts(week, parsed.data.replaceDrafts);
    res.status(202).json({ data: { week: week.toISOString() } });
  } catch (err) {
    handle(res, err);
  }
});

const editSchema = z.object({
  caption: z.string().trim().min(1).max(2200).optional(),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  scheduledAt: z.string().datetime().optional(),
});

async function loadPost(id: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id } });
  if (!post) throw new PlannerError('Post not found.', 404);
  return post;
}

router.patch('/posts/:id', async (req: Request, res: Response) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  try {
    const post = await loadPost(req.params.id);
    if (post.status === 'PUBLISHED') throw new PlannerError('A published post can no longer be edited.');
    const { caption, hashtags, scheduledAt } = parsed.data;
    const updated = await prisma.marketingPost.update({
      where: { id: post.id },
      data: {
        ...(caption !== undefined && caption !== post.caption
          ? // Keep the agent's first version so it can learn from the edit.
            { caption, originalCaption: post.originalCaption ?? post.caption }
          : {}),
        ...(hashtags ? { hashtags: hashtags.map((h) => h.replace(/^#+/, '').replace(/\s+/g, '')) } : {}),
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      },
    });
    res.json({ data: view(updated) });
  } catch (err) {
    handle(res, err);
  }
});

const rewriteSchema = z.object({ feedback: z.string().trim().max(500).optional() });

router.post('/posts/:id/rewrite', async (req: Request, res: Response) => {
  const parsed = rewriteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  try {
    res.json({ data: view(await rewritePost(req.params.id, parsed.data.feedback || undefined)) });
  } catch (err) {
    handle(res, err);
  }
});

// Status moves allowed from each state; anything else is a 400.
const MOVES: Record<string, { from: string[]; to: string }> = {
  approve: { from: ['DRAFT', 'REJECTED'], to: 'APPROVED' },
  reject: { from: ['DRAFT', 'APPROVED'], to: 'REJECTED' },
  published: { from: ['APPROVED'], to: 'PUBLISHED' },
  unapprove: { from: ['APPROVED'], to: 'DRAFT' },
};
const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });

router.post('/posts/:id/:action(approve|reject|published|unapprove)', async (req: Request, res: Response) => {
  const move = MOVES[req.params.action];
  const body = rejectSchema.safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ errors: body.error.errors });
  try {
    const post = await loadPost(req.params.id);
    if (!move.from.includes(post.status)) throw new PlannerError(`Cannot ${req.params.action} a ${post.status} post.`);
    const now = new Date();
    const updated = await prisma.marketingPost.update({
      where: { id: post.id },
      data: {
        status: move.to,
        ...(move.to === 'APPROVED' ? { approvedAt: now, approvedById: req.user!.id, rejectionReason: null } : {}),
        ...(move.to === 'DRAFT' ? { approvedAt: null, approvedById: null } : {}),
        ...(move.to === 'REJECTED' ? { rejectionReason: body.data.reason || null } : {}),
        ...(move.to === 'PUBLISHED' ? { publishedAt: now } : {}),
      },
    });
    res.json({ data: view(updated) });
  } catch (err) {
    handle(res, err);
  }
});

router.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    const post = await loadPost(req.params.id);
    if (post.status === 'PUBLISHED') throw new PlannerError('A published post is kept as history.');
    await prisma.marketingPost.delete({ where: { id: post.id } });
    res.status(204).send();
  } catch (err) {
    handle(res, err);
  }
});

export default router;
