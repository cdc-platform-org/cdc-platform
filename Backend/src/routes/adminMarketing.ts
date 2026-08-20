import { Router, Request, Response } from 'express';
import { LaunchKitTargetType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { generateLaunchKit, MarketingAgentError } from '../services/marketingAgentService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

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

  try {
    const kit = await generateLaunchKit(
      productId ? LaunchKitTargetType.DIGITAL_PRODUCT : LaunchKitTargetType.COURSE,
      (productId ?? courseId)!,
      lang,
      req.user!.id
    );
    res.status(201).json({ data: kit });
  } catch (err) {
    if (err instanceof MarketingAgentError) return res.status(err.status).json({ message: err.message });
    throw err;
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

  const kits = await prisma.launchKit.findMany({
    where: productId ? { productId } : { courseId },
    include: { generatedByUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: kits });
});

// All kits across every product/course — powers the /admin/marketing
// dashboard's browse-everything view (distinct from the per-target history
// above, which is what the product/course page's drawer uses).
router.get('/launch-kits/all', async (_req: Request, res: Response) => {
  const kits = await prisma.launchKit.findMany({
    include: {
      generatedByUser: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, title: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ data: kits });
});

router.get('/launch-kits/:id', async (req: Request, res: Response) => {
  const kit = await prisma.launchKit.findUnique({
    where: { id: req.params.id },
    include: { generatedByUser: { select: { id: true, name: true, email: true } }, product: { select: { id: true, title: true } }, course: { select: { id: true, title: true } } },
  });
  if (!kit) return res.status(404).json({ message: 'Launch kit not found.' });
  res.json({ data: kit });
});

router.delete('/launch-kits/:id', async (req: Request, res: Response) => {
  const kit = await prisma.launchKit.findUnique({ where: { id: req.params.id } });
  if (!kit) return res.status(404).json({ message: 'Launch kit not found.' });
  await prisma.launchKit.delete({ where: { id: kit.id } });
  res.status(204).send();
});

export default router;
