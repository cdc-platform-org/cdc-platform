/**
 * Express router mounted at `/api/admin/product-agent` (see server.ts).
 * Endpoints:
 *   GET    /                 settings, spend, categories, recent runs, agent products
 *   PUT    /settings         on/off, daily counts, quality, budget, run hour
 *   POST   /run              create products now ({ categories: [...] }, one each)
 *   POST   /trends/refresh   write a fresh market brief now ({ categories?: [...] }, default all)
 *   DELETE /products/:id     delete an agent-made product that nobody bought ({ reason? })
 *
 * Approve / reject / edit of the products themselves stays on
 * /api/admin/products (adminProducts.ts) — the agent's rows are ordinary
 * PENDING DigitalProducts with createdByAgent = true.
 * Logic: services/productAgent/.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { AGENT_CATEGORIES, AGENT_CATEGORY_KEYS, isAgentCategoryKey } from '../../services/productAgent/categories';
import { getProductAgentSettings, getSpendSummary, settingsUpdateSchema, updateProductAgentSettings } from '../../services/productAgent/settings';
import { enqueueRuns, isAgentBusy } from '../../services/productAgent';
import { isAzureImageConfigured } from '../../services/ai/azureImageService';
import { latestTrendBriefs, refreshAllTrendBriefs } from '../../services/productAgent/trends';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (_req: Request, res: Response) => {
  const [settings, spend, runs, products, trendBriefs] = await Promise.all([
    getProductAgentSettings(),
    getSpendSummary(),
    prisma.productAgentRun.findMany({ orderBy: { startedAt: 'desc' }, take: 60 }),
    prisma.digitalProduct.findMany({
      where: { createdByAgent: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, titleEn: true, category: true, status: true, imageUrl: true, price: true, createdAt: true, salesCount: true },
    }),
    latestTrendBriefs(),
  ]);
  res.json({
    data: {
      settings,
      spend,
      busy: isAgentBusy(),
      configured: isAzureImageConfigured(),
      categories: AGENT_CATEGORY_KEYS.map((key) => ({ key, ...AGENT_CATEGORIES[key] })),
      runs,
      products,
      trendBriefs,
    },
  });
});

router.put('/settings', async (req: Request, res: Response) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  res.json({ data: await updateProductAgentSettings(parsed.data) });
});

router.post('/run', async (req: Request, res: Response) => {
  const parsed = z.object({ categories: z.array(z.string()).min(1).max(AGENT_CATEGORY_KEYS.length) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  const categories = [...new Set(parsed.data.categories)].filter(isAgentCategoryKey);
  if (!categories.length) return res.status(400).json({ message: 'Unknown category.' });
  try {
    const runIds = await enqueueRuns(categories, 'MANUAL');
    res.status(202).json({ data: { runIds } });
  } catch (err) {
    res.status(503).json({ message: err instanceof Error ? err.message : 'Agent unavailable.' });
  }
});

// Takes ~15 s per category, so it runs in the background (a full-category
// refresh would outlive App Service's request timeout); new briefs show up
// on the next page load. Failures are logged by refreshAllTrendBriefs.
router.post('/trends/refresh', async (req: Request, res: Response) => {
  const parsed = z.object({ categories: z.array(z.string()).optional() }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });
  const categories = (parsed.data.categories ?? AGENT_CATEGORY_KEYS).filter(isAgentCategoryKey);
  void refreshAllTrendBriefs(categories);
  res.status(202).json({ data: { categories } });
});

router.delete('/products/:id', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({
    where: { id: req.params.id },
    select: { id: true, createdByAgent: true, _count: { select: { purchases: true } } },
  });
  if (!product || !product.createdByAgent) return res.status(404).json({ message: 'Agent product not found.' });
  // A bought product must stay so the buyer keeps their download.
  if (product._count.purchases > 0) return res.status(409).json({ message: 'This product has purchases — reject/unpublish it instead of deleting.' });
  // The admin's reason is kept on the run so the agent learns from it
  // (trends.ts reads it as a DELETED outcome) after the product is gone.
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
  await prisma.productAgentRun.updateMany({ where: { productId: product.id }, data: { error: `Deleted by admin${reason ? `: ${reason}` : ''}` } });
  await prisma.digitalProduct.delete({ where: { id: product.id } });
  res.json({ data: { id: product.id } });
});

export default router;
