/**
 * Express router mounted at `/api/designs` (see server.ts) — the buyer side
 * of the design editor. Thin HTTP layer; rules live in services/designs/.
 * Endpoints:
 *   GET    /products              purchased products that have an editable template (+ my designs)
 *   POST   /                      create a design from a purchased product's template
 *   GET    /:id                   load a design
 *   PUT    /:id                   save a design (full document)
 *   POST   /:id/reset             start over from the product's current template
 *   DELETE /:id                   delete a design
 *   POST   /:id/assets            upload a photo/logo (multipart field "image")
 *   GET    /:id/assets?ref=…      stream an image used by the design
 * Admin template upload lives in routes/admin/adminProducts.ts.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { imageUpload, multerErrorHandler } from '../middleware/productUploads';
import { createDesignSchema, saveDesignSchema } from '../schemas/designTemplateSchemas';
import {
  listEditableProducts, createDesignFromTemplate, getOwnedDesign, saveDesign, deleteDesign, resetDesign,
} from '../services/designs/designService';
import { storeDesignUpload, loadDesignAsset } from '../services/designs/designAssets';

const router = Router();
router.use(authenticate, requireApproved);

const byUser = (req: Request) => req.user!.id;
// Autosave fires every few seconds while someone types.
const saveRateLimit = rateLimit({ windowMs: 60_000, max: 60, keyGenerator: byUser, message: 'Too many saves, please wait a moment.' });
const uploadRateLimit = rateLimit({ windowMs: 60 * 60_000, max: 60, keyGenerator: byUser, message: 'Too many uploads, please try again later.' });
// A 30-page planner can reference a few dozen images on first open.
const assetRateLimit = rateLimit({ windowMs: 60_000, max: 300, keyGenerator: byUser });

router.get('/products', async (req: Request, res: Response) => {
  res.json({ data: await listEditableProducts(req.user!.id) });
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createDesignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid request', details: parsed.error.flatten() });
  const design = await createDesignFromTemplate(req.user!.id, parsed.data.productId, parsed.data.title);
  res.status(201).json({ data: { id: design.id } });
});

router.get('/:id', async (req: Request, res: Response) => {
  const design = await getOwnedDesign(req.user!.id, req.params.id);
  res.json({
    data: {
      id: design.id, title: design.title, productId: design.productId,
      data: design.data, templateVersion: design.templateVersion, updatedAt: design.updatedAt,
    },
  });
});

router.put('/:id', saveRateLimit, async (req: Request, res: Response) => {
  const parsed = saveDesignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid design', details: parsed.error.issues.slice(0, 10) });
  }
  res.json({ data: await saveDesign(req.user!.id, req.params.id, parsed.data) });
});

router.post('/:id/reset', async (req: Request, res: Response) => {
  const design = await resetDesign(req.user!.id, req.params.id);
  res.json({ data: { id: design.id, data: design.data, templateVersion: design.templateVersion } });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await deleteDesign(req.user!.id, req.params.id);
  res.status(204).end();
});

router.post(
  '/:id/assets',
  uploadRateLimit,
  // Ownership first, so a non-buyer can't even make us buffer a 10 MB body.
  async (req: Request, _res: Response, next: NextFunction) => {
    await getOwnedDesign(req.user!.id, req.params.id);
    next();
  },
  (req: Request, res: Response, next: NextFunction) => imageUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded.' });
    res.status(201).json({ data: await storeDesignUpload(req.user!.id, req.file.buffer) });
  },
);

router.get('/:id/assets', assetRateLimit, async (req: Request, res: Response) => {
  const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
  if (!ref) return res.status(400).json({ message: 'Missing ref.' });
  await getOwnedDesign(req.user!.id, req.params.id);
  const asset = await loadDesignAsset(req.user!.id, ref);
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(asset.buffer);
});

export default router;
