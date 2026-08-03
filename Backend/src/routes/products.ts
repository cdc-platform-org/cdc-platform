import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, requireApproved } from '../middleware/auth';

const router = Router();

// ============================================================
// CATALOG — public, but attaches `purchased` per item when a valid token
// is present (optionalAuthenticate) so the store can show "შენი ნაყიდი".
// Only ever shows APPROVED products — PENDING/REJECTED submissions are
// only visible to their submitter (GET /:id below) or admins (adminProducts.ts).
// ============================================================
router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const products = await prisma.digitalProduct.findMany({
    where: { status: 'APPROVED', ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  const purchasedIds = req.user
    ? new Set(
        (
          await prisma.productPurchase.findMany({
            where: { userId: req.user.id, paymentStatus: 'COMPLETED', productId: { in: products.map((p) => p.id) } },
            select: { productId: true },
          })
        ).map((p) => p.productId)
      )
    : new Set<string>();

  res.json({
    data: products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      imageUrl: p.imageUrl,
      downloadsCount: p.downloadsCount,
      createdAt: p.createdAt,
      purchased: purchasedIds.has(p.id),
    })),
  });
});

router.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  // Not-yet-approved products are only visible to whoever submitted them —
  // everyone else (including other logged-in users) gets a 404, same as if
  // it didn't exist. Admins review these via GET /admin/products instead.
  if (product.status !== 'APPROVED' && product.submittedById !== req.user?.id) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  let purchased = false;
  if (req.user) {
    const purchase = await prisma.productPurchase.findUnique({
      where: { userId_productId: { userId: req.user.id, productId: product.id } },
    });
    purchased = purchase?.paymentStatus === 'COMPLETED';
  }

  res.json({
    data: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
      downloadsCount: product.downloadsCount,
      createdAt: product.createdAt,
      purchased,
      status: product.status,
      rejectionReason: product.rejectionReason,
    },
  });
});

const submitSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().min(0),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  fileUrl: z.string().url(),
});

// ============================================================
// SUBMIT — verified freelancers/graduates (isVerifiedGraduate — the same
// flag set by either passing the freelancer skill exam or completing a
// CDC course, see freelancerExam.ts/courses.ts) and admin-team members can
// submit a product for review. Always lands as PENDING here regardless of
// who submits — only adminProducts.ts's admin-authored POST / inserts as
// APPROVED directly.
// ============================================================
router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { isVerifiedGraduate: true, adminRole: true },
  });
  if (!user?.isVerifiedGraduate && !user?.adminRole) {
    return res.status(403).json({
      message: 'Only verified graduates/freelancers or admins can submit products for review.',
    });
  }

  const result = submitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.create({
    data: {
      ...result.data,
      price: Math.round(result.data.price * 100),
      status: 'PENDING',
      submittedById: req.user!.id,
    },
  });
  res.status(201).json({ data: product });
});

router.get('/mine/submissions', authenticate, requireApproved, async (req: Request, res: Response) => {
  const products = await prisma.digitalProduct.findMany({
    where: { submittedById: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: products });
});

// ============================================================
// CLAIM — free (price = 0) products only. Paid products go through
// POST /api/payments/checkout/product/:productId (BOG) instead.
// ============================================================
router.post('/:id/claim', authenticate, requireApproved, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.price > 0) {
    return res.status(400).json({ message: 'This product is not free — use the checkout flow instead.' });
  }

  await prisma.productPurchase.upsert({
    where: { userId_productId: { userId: req.user!.id, productId: product.id } },
    update: {},
    create: { userId: req.user!.id, productId: product.id, amount: 0, paymentStatus: 'COMPLETED' },
  });

  res.status(200).json({ data: { claimed: true } });
});

// ============================================================
// DOWNLOAD — never returns fileUrl to anyone without a verified COMPLETED
// purchase; also fine for lifetime re-downloads (no expiry check).
// ============================================================
router.get('/:id/download', authenticate, requireApproved, async (req: Request, res: Response) => {
  const purchase = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId: req.user!.id, productId: req.params.id } },
  });
  if (!purchase || purchase.paymentStatus !== 'COMPLETED') {
    return res.status(403).json({ message: 'You have not purchased this product.' });
  }

  const product = await prisma.digitalProduct.update({
    where: { id: req.params.id },
    data: { downloadsCount: { increment: 1 } },
  });

  res.json({ data: { fileUrl: product.fileUrl } });
});

export default router;
