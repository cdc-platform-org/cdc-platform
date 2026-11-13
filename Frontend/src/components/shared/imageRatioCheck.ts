// Aspect-ratio / resolution check for product images uploaded through
// ImageGalleryUploader. The public store shows the cover in a 16:9 card
// (marketplace/index.tsx) and cover + screenshots in a 4:3 gallery
// (shared/ProductGallery.tsx), both with object-fit: cover — so an image of
// another shape is silently cropped. This only warns; it never blocks upload.
import { SupportedLocale } from '../../utils/locale';

export interface RecommendedImageSize {
  width: number;
  height: number;
}

// Store products: 4:3 matches the detail gallery exactly; the 16:9 card
// keeps the middle ~75% of the height, so key content belongs in the centre.
export const PRODUCT_IMAGE_SIZE: RecommendedImageSize = { width: 2000, height: 1500 };

export interface ImageDims {
  w: number;
  h: number;
}

// ±4% still looks right in the gallery (e.g. 1600×1210 is fine).
const RATIO_TOLERANCE = 0.04;
// Below ~60% of the recommended width the image looks soft in the
// full-width gallery on desktop.
const MIN_WIDTH_FACTOR = 0.6;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function ratioLabel(w: number, h: number): string {
  const g = gcd(w, h);
  const rw = w / g;
  const rh = h / g;
  // 1366×768-style sizes reduce to ugly ratios — show a decimal instead.
  return rw <= 32 && rh <= 32 ? `${rw}:${rh}` : `${(w / h).toFixed(2)}:1`;
}

const TEXT = {
  ka: {
    ratio: (d: ImageDims, rec: RecommendedImageSize) =>
      `ამ სურათის ზომაა ${d.w}×${d.h} px (${ratioLabel(d.w, d.h)}). რეკომენდებულია ${ratioLabel(rec.width, rec.height)} (${rec.width}×${rec.height} px), თორემ მაღაზიაში კიდეები მოიჭრება.`,
    small: (d: ImageDims, rec: RecommendedImageSize) =>
      `სურათი პატარაა (${d.w}×${d.h} px) და შეიძლება ბუნდოვნად გამოჩნდეს. რეკომენდებულია მინიმუმ ${Math.round(rec.width * MIN_WIDTH_FACTOR)} px სიგანე.`,
    gallery: (n: number, rec: RecommendedImageSize) =>
      `${n} სქრინშოტი არ არის ${ratioLabel(rec.width, rec.height)} პროპორციის ან ძალიან პატარაა (მონიშნულია !-ით) — გალერეაში მოიჭრება.`,
  },
  en: {
    ratio: (d: ImageDims, rec: RecommendedImageSize) =>
      `This image is ${d.w}×${d.h} px (${ratioLabel(d.w, d.h)}). ${ratioLabel(rec.width, rec.height)} (${rec.width}×${rec.height} px) is recommended, otherwise the edges get cropped in the store.`,
    small: (d: ImageDims, rec: RecommendedImageSize) =>
      `The image is small (${d.w}×${d.h} px) and may look blurry. At least ${Math.round(rec.width * MIN_WIDTH_FACTOR)} px wide is recommended.`,
    gallery: (n: number, rec: RecommendedImageSize) =>
      `${n} screenshot(s) are not ${ratioLabel(rec.width, rec.height)} or are too small (marked with !) — they will be cropped in the gallery.`,
  },
};

type Dict = (typeof TEXT)['en'];

function dictsFor(lang: SupportedLocale, bilingual: boolean): Dict[] {
  if (bilingual) return [TEXT.ka, TEXT.en];
  return [lang === 'ka' ? TEXT.ka : TEXT.en];
}

export function isOffRatio(d: ImageDims, rec: RecommendedImageSize): boolean {
  const target = rec.width / rec.height;
  return Math.abs(d.w / d.h - target) / target > RATIO_TOLERANCE;
}

export function isTooSmall(d: ImageDims, rec: RecommendedImageSize): boolean {
  return d.w < rec.width * MIN_WIDTH_FACTOR;
}

export function hasImageIssue(d: ImageDims | undefined, rec: RecommendedImageSize | undefined): boolean {
  return !!d && !!rec && (isOffRatio(d, rec) || isTooSmall(d, rec));
}

// Lines to show under the cover (one per language when bilingual).
export function coverWarnings(
  d: ImageDims | undefined,
  rec: RecommendedImageSize | undefined,
  lang: SupportedLocale,
  bilingual: boolean,
): string[] {
  if (!d || !rec) return [];
  const dicts = dictsFor(lang, bilingual);
  if (isOffRatio(d, rec)) return dicts.map((t) => t.ratio(d, rec));
  if (isTooSmall(d, rec)) return dicts.map((t) => t.small(d, rec));
  return [];
}

export function galleryWarnings(
  count: number,
  rec: RecommendedImageSize | undefined,
  lang: SupportedLocale,
  bilingual: boolean,
): string[] {
  if (!rec || count === 0) return [];
  return dictsFor(lang, bilingual).map((t) => t.gallery(count, rec));
}
