/**
 * Product agent — uploads a finished product's images/files and saves it as
 * a PENDING DigitalProduct flagged createdByAgent.
 * Exports: ProductDraft, DraftFile, publishDraft.
 *
 * Cover and gallery go through the same watermark/downscale step as admin
 * uploads (productImageProtection.ts); product files go to private blob
 * storage (cdcblob:// markers) and are only released after purchase.
 */
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { uploadImage } from '../integrations/imageStorage';
import { protectProductPreviewImage } from '../marketplace/productImageProtection';
import { uploadProductFile } from '../marketplace/productFileDelivery';
import { AGENT_CATEGORIES, AgentCategoryKey } from './categories';

export interface DraftFile {
  buffer: Buffer;
  name: string;
  mimetype: string;
}

export interface ProductDraft {
  category: AgentCategoryKey;
  titleKa: string;
  titleEn: string;
  descriptionKa: string;
  descriptionEn: string;
  priceGel: number;
  license: 'PERSONAL_USE' | 'COMMERCIAL_USE';
  cover: Buffer;
  gallery: Buffer[];
  files: DraftFile[];
}

async function uploadPreview(buffer: Buffer): Promise<string> {
  const protectedImage = await protectProductPreviewImage(buffer, 'image/jpeg');
  return uploadImage({
    buffer: protectedImage.buffer,
    mimetype: protectedImage.mimetype,
    folderName: 'product-images',
    filename: `product-${Date.now()}-${crypto.randomUUID()}.jpg`,
  });
}

export async function publishDraft(draft: ProductDraft): Promise<string> {
  if (!draft.files.length) throw new Error('A product needs at least one file.');
  const imageUrl = await uploadPreview(draft.cover);
  const previewImages: string[] = [];
  for (const g of draft.gallery.slice(0, 15)) previewImages.push(await uploadPreview(g));
  const uploaded: { url: string; name: string }[] = [];
  for (const f of draft.files.slice(0, 21)) uploaded.push({ url: await uploadProductFile(f.buffer, f.mimetype, f.name), name: f.name });
  const [main, ...rest] = uploaded;
  const product = await prisma.digitalProduct.create({
    data: {
      title: draft.titleKa.slice(0, 200),
      titleEn: draft.titleEn.slice(0, 200),
      description: draft.descriptionKa,
      descriptionEn: draft.descriptionEn,
      price: Math.round(draft.priceGel * 100),
      category: AGENT_CATEGORIES[draft.category].storeCategory,
      imageUrl,
      previewImages,
      fileUrl: main.url,
      fileName: main.name,
      additionalFiles: rest,
      licenseType: draft.license,
      // Never public until an admin approves it on the admin products page.
      status: 'PENDING',
      createdByAgent: true,
    },
    select: { id: true },
  });
  return product.id;
}
