import { Router, Request, Response } from 'express';
import { LaunchKitTargetType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { generateLaunchKit, MarketingAgentError } from '../services/marketingAgentService';

// ============================================================
// CREATOR-FACING AI SALES & MARKETING MANAGER — the self-service counterpart
// to routes/adminMarketing.ts, for a Mentor generating a kit for their own
// Instructor Studio course, or any digital-product seller generating one for
// their own DigitalProduct. Reuses generateLaunchKit() as-is (it already
// takes generatedByUserId purely for the audit trail, with no notion of
// "admin" baked in) — the only thing this file adds on top is per-request
// ownership authorization, since unlike the admin route (any SUPER_ADMIN/
// MANAGER may target any product/course), a creator may only ever touch a
// LaunchKit for content they themselves own.
//
// Deliberately free of any credit/usage-limit/billing check, same as the
// admin path — this is a zero-paywall creator tool by design, gated only on
// ownership of the target, never on a subscription or quota.
// ============================================================

const router = Router();
router.use(authenticate, requireApproved);

export class OwnershipError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Verifies the calling user owns the given product/course before letting
// them touch any LaunchKit tied to it — a DigitalProduct.submittedById or
// Course.instructorId match, nothing else (not role, not adminRole; owning
// the specific target IS the authorization here). 404 rather than 403 for a
// real-but-not-owned target, same "don't reveal existence" convention
// instructorCourses.ts's requireOwnedCourse already uses for the identical
// situation.
export async function assertOwnedTarget(targetType: LaunchKitTargetType, targetId: string, userId: string): Promise<void> {
  if (targetType === LaunchKitTargetType.DIGITAL_PRODUCT) {
    const product = await prisma.digitalProduct.findUnique({ where: { id: targetId }, select: { submittedById: true } });
    if (!product || product.submittedById !== userId) {
      throw new OwnershipError(404, 'Product not found.');
    }
  } else {
    const course = await prisma.course.findUnique({ where: { id: targetId }, select: { instructorId: true } });
    if (!course || course.instructorId !== userId) {
      throw new OwnershipError(404, 'Course not found.');
    }
  }
}

function handleError(err: unknown, res: Response): boolean {
  if (err instanceof OwnershipError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  if (err instanceof MarketingAgentError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  return false;
}

const generateSchema = z
  .object({
    productId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    lang: z.enum(['ka', 'en']).optional().default('ka'),
  })
  .refine((v) => (!!v.productId) !== (!!v.courseId), { message: 'Provide exactly one of productId or courseId.' });

router.post('/launch-kits', async (req: Request, res: Response) => {
  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { productId, courseId, lang } = result.data;
  const targetType = productId ? LaunchKitTargetType.DIGITAL_PRODUCT : LaunchKitTargetType.COURSE;
  const targetId = (productId ?? courseId)!;

  try {
    await assertOwnedTarget(targetType, targetId, req.user!.id);
    const kit = await generateLaunchKit(targetType, targetId, lang, req.user!.id);
    res.status(201).json({ data: kit });
  } catch (err) {
    if (!handleError(err, res)) throw err;
  }
});

const listQuerySchema = z
  .object({
    productId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
  })
  .refine((v) => !!v.productId !== !!v.courseId, { message: 'Provide exactly one of productId or courseId.' });

router.get('/launch-kits', async (req: Request, res: Response) => {
  const result = listQuerySchema.safeParse(req.query);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { productId, courseId } = result.data;
  const targetType = productId ? LaunchKitTargetType.DIGITAL_PRODUCT : LaunchKitTargetType.COURSE;
  const targetId = (productId ?? courseId)!;

  try {
    await assertOwnedTarget(targetType, targetId, req.user!.id);
    const kits = await prisma.launchKit.findMany({
      where: productId ? { productId } : { courseId },
      include: { generatedByUser: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: kits });
  } catch (err) {
    if (!handleError(err, res)) throw err;
  }
});

// Loads a kit and re-derives ownership from whichever of its product/course
// it belongs to — the kit row itself has no owner column, only
// productId/courseId, so ownership always flows through the target.
async function loadOwnedKit(id: string, userId: string) {
  const kit = await prisma.launchKit.findUnique({
    where: { id },
    include: { generatedByUser: { select: { id: true, name: true, email: true } }, product: { select: { id: true, title: true } }, course: { select: { id: true, title: true } } },
  });
  if (!kit) throw new OwnershipError(404, 'Launch kit not found.');
  await assertOwnedTarget(kit.targetType, (kit.productId ?? kit.courseId)!, userId);
  return kit;
}

router.get('/launch-kits/:id', async (req: Request, res: Response) => {
  try {
    const kit = await loadOwnedKit(req.params.id, req.user!.id);
    res.json({ data: kit });
  } catch (err) {
    if (!handleError(err, res)) throw err;
  }
});

router.delete('/launch-kits/:id', async (req: Request, res: Response) => {
  try {
    const kit = await loadOwnedKit(req.params.id, req.user!.id);
    await prisma.launchKit.delete({ where: { id: kit.id } });
    res.status(204).send();
  } catch (err) {
    if (!handleError(err, res)) throw err;
  }
});

export default router;
