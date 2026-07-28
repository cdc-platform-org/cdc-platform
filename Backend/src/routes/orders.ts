import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { orderCreateSchema, orderUpdateSchema } from '../schemas/orderSchemas';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();

// Enterprise/B2B bulk-course orders — contains business contact PII
// (enterprise name + contactEmail) and lets a caller flip an order's
// status, so this is admin-team-only, same tier as blog/CMS content
// management (SUPER_ADMIN + MANAGER). Previously had no auth at all.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { courses: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: orders });
});

router.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { courses: true },
  });
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }
  res.json({ data: order });
});

router.post('/', async (req, res) => {
  const result = orderCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { courseIds, ...rest } = result.data;
  try {
    const order = await prisma.order.create({
      data: { ...rest, courses: { connect: courseIds.map((id) => ({ id })) } },
      include: { courses: true },
    });
    res.status(201).json({ data: order });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(400).json({ message: 'One or more courseIds do not exist.' });
    }
    throw err;
  }
});

router.patch('/:id', async (req, res) => {
  const result = orderUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: result.data.status },
      include: { courses: true },
    });
    res.json({ data: order });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Order not found.' });
    }
    throw err;
  }
});

export default router;
