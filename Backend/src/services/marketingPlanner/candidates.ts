/**
 * Marketing planner — which store products are worth promoting this week.
 * Exports: ProductCandidate, productUrl, loadCandidates.
 *
 * Picking is done by code (live, approved products scored by highlight,
 * sales, newness and active sale, minus anything promoted recently); the
 * model only chooses among these ids. The product link is always built here
 * from the id, so a post can never carry a made-up URL.
 */
import { prisma } from '../../lib/prisma';
import { getCurrentProductPrice, isProductSaleActive } from '../marketplace/productPricing';
import { highlightRank, normalizeProductCategory } from '../marketplace/productCategories';

const SITE_URL = (process.env.FRONTEND_URL || 'https://cdc.org.ge').replace(/\/+$/, '');
// A product promoted (and not rejected) within this many days is skipped,
// so the feed doesn't repeat itself.
const REPEAT_COOLDOWN_DAYS = 21;
const MAX_CANDIDATES = 30;

export interface ProductCandidate {
  id: string;
  title: string;
  description: string;
  category: string;
  priceGel: number;
  oldPriceGel: number | null;
  highlight: string | null;
  salesCount: number;
  isNew: boolean;
  imageUrl: string;
  url: string;
}

export function productUrl(productId: string): string {
  return `${SITE_URL}/store/${encodeURIComponent(productId)}`;
}

export async function loadCandidates(now = new Date()): Promise<ProductCandidate[]> {
  const since = new Date(now.getTime() - REPEAT_COOLDOWN_DAYS * 86_400_000);
  const recent = await prisma.marketingPost.findMany({
    where: { productId: { not: null }, status: { not: 'REJECTED' }, scheduledAt: { gte: since } },
    select: { productId: true },
  });
  const skip = new Set(recent.map((r) => r.productId!));

  const products = await prisma.digitalProduct.findMany({
    where: { status: 'APPROVED' },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      price: true,
      discountedPrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      highlight: true,
      salesCount: true,
      imageUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  const scored = products
    .filter((p) => !skip.has(p.id) && p.imageUrl)
    .map((p) => {
      const ageDays = (now.getTime() - p.createdAt.getTime()) / 86_400_000;
      const onSale = isProductSaleActive(p);
      const score =
        // highlightRank: 0 = BESTSELLER … 4 = unflagged, so invert it.
        (4 - highlightRank(p.highlight)) * 3 + Math.min(p.salesCount, 50) / 5 + (ageDays <= 30 ? 4 : 0) + (onSale ? 5 : 0) + Math.random();
      return { p, score, onSale, isNew: ageDays <= 30 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  return scored.map(({ p, onSale, isNew }) => ({
    id: p.id,
    title: p.title,
    description: p.description.slice(0, 600),
    category: normalizeProductCategory(p.category, p.title),
    priceGel: getCurrentProductPrice(p) / 100,
    oldPriceGel: onSale ? p.price / 100 : null,
    highlight: p.highlight,
    salesCount: p.salesCount,
    isNew,
    imageUrl: p.imageUrl,
    url: productUrl(p.id),
  }));
}
