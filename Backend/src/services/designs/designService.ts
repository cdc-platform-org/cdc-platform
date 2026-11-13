/**
 * Design editor — business rules for buyers' editable designs.
 *
 * A buyer may open the editor only for a DigitalProduct they hold a
 * COMPLETED ProductPurchase for (same rule as GET /api/products/:id/download)
 * and that has a ProductTemplate. Each "design" is the buyer's own copy of
 * that template (UserDesign); editing never touches the product's template.
 *
 * HTTP layer: routes/designs.ts. Image upload/serving: ./designAssets.ts.
 * Template format: schemas/designTemplateSchemas.ts.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { DesignTemplate, MAX_DESIGN_JSON_BYTES, designTemplateSchema } from '../../schemas/designTemplateSchemas';

// A buyer can keep several variants of one product (e.g. invitations for
// two events) but not an unbounded number.
export const MAX_DESIGNS_PER_PRODUCT = 20;

export class DesignError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'DesignError';
  }
}

export async function hasCompletedPurchase(userId: string, productId: string): Promise<boolean> {
  const purchase = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { paymentStatus: true },
  });
  return purchase?.paymentStatus === 'COMPLETED';
}

// Purchased products that can be opened in the editor, with the buyer's
// existing designs for each — powers the dashboard "My designs" screen.
export async function listEditableProducts(userId: string) {
  const purchases = await prisma.productPurchase.findMany({
    where: { userId, paymentStatus: 'COMPLETED', product: { editableTemplate: { isNot: null } } },
    orderBy: { createdAt: 'desc' },
    select: {
      product: {
        select: {
          id: true, title: true, titleEn: true, imageUrl: true, category: true,
          userDesigns: {
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, updatedAt: true },
          },
        },
      },
    },
  });
  return purchases.map(({ product }) => ({
    id: product.id,
    title: product.title,
    titleEn: product.titleEn,
    imageUrl: product.imageUrl,
    category: product.category,
    designs: product.userDesigns,
  }));
}

export async function createDesignFromTemplate(userId: string, productId: string, title?: string) {
  if (!(await hasCompletedPurchase(userId, productId))) {
    throw new DesignError(403, 'You have not purchased this product.', 'NOT_PURCHASED');
  }
  const product = await prisma.digitalProduct.findUnique({
    where: { id: productId },
    select: { title: true, editableTemplate: { select: { data: true, version: true } } },
  });
  if (!product?.editableTemplate) {
    throw new DesignError(404, 'This product has no editable template.', 'NO_TEMPLATE');
  }
  const existing = await prisma.userDesign.count({ where: { userId, productId } });
  if (existing >= MAX_DESIGNS_PER_PRODUCT) {
    throw new DesignError(409, `You can keep at most ${MAX_DESIGNS_PER_PRODUCT} designs per product.`, 'TOO_MANY_DESIGNS');
  }
  return prisma.userDesign.create({
    data: {
      userId,
      productId,
      title: title || (existing ? `${product.title} (${existing + 1})` : product.title),
      data: product.editableTemplate.data as Prisma.InputJsonValue,
      templateVersion: product.editableTemplate.version,
    },
  });
}

// Loads a design for its owner. Access is re-checked against the purchase
// on every read so a refunded purchase (paymentStatus no longer COMPLETED)
// also loses editor access, not just downloads.
export async function getOwnedDesign(userId: string, designId: string) {
  const design = await prisma.userDesign.findUnique({ where: { id: designId } });
  if (!design || design.userId !== userId) throw new DesignError(404, 'Design not found.');
  if (!(await hasCompletedPurchase(userId, design.productId))) {
    throw new DesignError(403, 'You have not purchased this product.', 'NOT_PURCHASED');
  }
  return design;
}

export function assertDesignSize(data: DesignTemplate) {
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_DESIGN_JSON_BYTES) {
    throw new DesignError(413, 'Design is too large.', 'TOO_LARGE');
  }
}

export async function saveDesign(userId: string, designId: string, input: { title?: string; data: DesignTemplate }) {
  await getOwnedDesign(userId, designId);
  assertDesignSize(input.data);
  return prisma.userDesign.update({
    where: { id: designId },
    data: { data: input.data as unknown as Prisma.InputJsonValue, ...(input.title ? { title: input.title } : {}) },
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function deleteDesign(userId: string, designId: string) {
  const design = await prisma.userDesign.findUnique({ where: { id: designId }, select: { userId: true } });
  if (!design || design.userId !== userId) throw new DesignError(404, 'Design not found.');
  await prisma.userDesign.delete({ where: { id: designId } });
}

// Starts the design over from the product's current template.
export async function resetDesign(userId: string, designId: string) {
  const design = await getOwnedDesign(userId, designId);
  const template = await prisma.productTemplate.findUnique({ where: { productId: design.productId } });
  if (!template) throw new DesignError(404, 'This product has no editable template.', 'NO_TEMPLATE');
  return prisma.userDesign.update({
    where: { id: designId },
    data: { data: template.data as Prisma.InputJsonValue, templateVersion: template.version },
  });
}

// ---- admin side --------------------------------------------------------

export function parseTemplateOrThrow(raw: unknown): DesignTemplate {
  const parsed = designTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new DesignError(400, `Invalid template: ${issues.join('; ')}`, 'INVALID_TEMPLATE');
  }
  assertDesignSize(parsed.data);
  return parsed.data;
}

export async function upsertProductTemplate(productId: string, template: DesignTemplate) {
  const product = await prisma.digitalProduct.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new DesignError(404, 'Product not found.');
  const data = template as unknown as Prisma.InputJsonValue;
  return prisma.productTemplate.upsert({
    where: { productId },
    create: { productId, data },
    update: { data, version: { increment: 1 } },
    select: { productId: true, version: true, updatedAt: true },
  });
}
