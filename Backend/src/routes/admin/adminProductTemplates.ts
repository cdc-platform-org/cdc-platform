/**
 * Express router mounted at `/api/admin/product-templates` (see server.ts) —
 * the admin side of the design editor: attach, read or remove the editable
 * "cdc-template/1" layout of a Digital Store product. Buyers' copies are
 * served by routes/designs.ts; validation lives in schemas/designTemplateSchemas.ts.
 * Endpoints:
 *   GET    /:productId     current template (or 404)
 *   PUT    /:productId     replace/attach a template (body = the template JSON)
 *   POST   /validate       check a template without saving it
 *   DELETE /:productId     detach the template (existing buyer designs are kept)
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { parseTemplateOrThrow, upsertProductTemplate } from '../../services/designs/designService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.post('/validate', async (req: Request, res: Response) => {
  const template = parseTemplateOrThrow(req.body);
  res.json({ data: { valid: true, pages: template.pages.length } });
});

router.get('/:productId', async (req: Request, res: Response) => {
  const template = await prisma.productTemplate.findUnique({ where: { productId: req.params.productId } });
  if (!template) return res.status(404).json({ message: 'No template for this product.' });
  res.json({ data: template });
});

router.put('/:productId', async (req: Request, res: Response) => {
  const template = parseTemplateOrThrow(req.body);
  res.json({ data: await upsertProductTemplate(req.params.productId, template) });
});

router.delete('/:productId', async (req: Request, res: Response) => {
  await prisma.productTemplate.deleteMany({ where: { productId: req.params.productId } });
  res.status(204).end();
});

export default router;
