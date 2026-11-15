/**
 * Zod schemas for the editable design template format "cdc-template/1".
 *
 * One format is used in three places, so it lives here once:
 *   - DigitalProduct templates an admin (or the AI product agent) uploads
 *     (ProductTemplate.data, see routes/admin/adminProducts.ts),
 *   - a buyer's saved copy of that template (UserDesign.data, routes/designs.ts),
 *   - the Frontend editor (Frontend/src/components/designEditor/), which keeps a
 *     matching TypeScript type in Frontend/src/types/designTemplate.ts.
 *
 * Geometry is in millimetres from the page's top-left corner, so a template
 * means the same thing at any screen zoom or export DPI. x/y/w/h describe the
 * element's box BEFORE rotation; rotation (degrees) turns it around its centre.
 * Elements are drawn in array order (first = bottom).
 *
 * Image `src` is either an https URL on our own storage or a
 * `cdcdesign://<blobName>` ref for a photo the buyer uploaded. The client
 * never loads these directly: it asks GET /api/designs/:id/assets, which
 * checks ownership and the host allowlist (see services/designs/designAssets.ts).
 */
import { z } from 'zod';

export const DESIGN_TEMPLATE_FORMAT = 'cdc-template/1';

// The fonts the editor bundles (Frontend/src/components/designEditor/fonts.ts).
// A template may only use these, otherwise Georgian letters could fall back to
// a system font and look different in the export than in the editor.
export const DESIGN_FONT_FAMILIES = [
  'FiraGO',
  'Noto Sans Georgian',
  'Noto Serif Georgian',
  'Google Sans',
  'Literata', // Latin serif; Georgian letters fall back to Noto Serif Georgian
] as const;

const MAX_PAGE_MM = 1200; // A0 is 841 x 1189 mm — the largest print we sell.
const MAX_PAGES = 30;
const MAX_ELEMENTS_PER_PAGE = 150;
const MAX_TEXT_LENGTH = 5000;

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected a #rgb/#rrggbb/#rrggbbaa color');
const mm = z.number().finite().min(-MAX_PAGE_MM).max(MAX_PAGE_MM * 2);
const positiveMm = z.number().finite().min(0.5).max(MAX_PAGE_MM * 2);
const elementId = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, _ or -');

// https URL or a buyer upload ref. Anything else (data:, javascript:, http:)
// is refused so a saved design can't be used to smuggle arbitrary content.
export const DESIGN_ASSET_REF_SCHEME = 'cdcdesign://';
export const designImageSrc = z.string().max(2048).refine(
  (value) => value.startsWith('https://') || value.startsWith(DESIGN_ASSET_REF_SCHEME),
  'Image src must be an https URL or an uploaded image ref',
);

const baseElement = {
  id: elementId,
  xMm: mm,
  yMm: mm,
  wMm: positiveMm,
  hMm: positiveMm,
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  // editable=false hides the element from the buyer's property panel;
  // locked=true stops it being moved/resized (it can still be edited if
  // editable). Both are template-author hints, not a security boundary.
  editable: z.boolean().default(true),
  locked: z.boolean().default(false),
  label: z.string().trim().max(80).optional(),
};

export const textElementSchema = z.object({
  ...baseElement,
  type: z.literal('text'),
  text: z.string().max(MAX_TEXT_LENGTH),
  fontFamily: z.enum(DESIGN_FONT_FAMILIES),
  fontSizePt: z.number().min(4).max(400),
  fontWeight: z.union([z.literal(400), z.literal(700)]).default(400),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  color: hexColor,
  align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  lineHeight: z.number().min(0.5).max(4).default(1.2),
  // Extra space between letters, in thousandths of an em (CSS/Fabric "charSpacing").
  letterSpacing: z.number().min(-200).max(2000).default(0),
});

export const imageElementSchema = z.object({
  ...baseElement,
  type: z.literal('image'),
  src: designImageSrc,
  fit: z.enum(['cover', 'contain']).default('cover'),
  clip: z.enum(['rect', 'circle']).default('rect'),
  // True for "put your photo here" slots — the editor highlights them.
  placeholder: z.boolean().default(false),
});

export const shapeElementSchema = z.object({
  ...baseElement,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'line']),
  fill: hexColor.nullable().default(null),
  stroke: hexColor.nullable().default(null),
  strokeWidthMm: z.number().min(0).max(50).default(0),
  radiusMm: z.number().min(0).max(500).default(0),
});

export const designElementSchema = z.discriminatedUnion('type', [
  textElementSchema,
  imageElementSchema,
  shapeElementSchema,
]);

const pageBackground = z.union([
  hexColor,
  z.object({ imageUrl: designImageSrc, color: hexColor.optional() }),
]);

export const designPageSchema = z.object({
  id: elementId,
  background: pageBackground.optional(),
  elements: z.array(designElementSchema).max(MAX_ELEMENTS_PER_PAGE),
}).superRefine((page, ctx) => {
  const seen = new Set<string>();
  page.elements.forEach((element, index) => {
    if (seen.has(element.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['elements', index, 'id'], message: `Duplicate element id "${element.id}"` });
    }
    seen.add(element.id);
  });
});

export const designTemplateSchema = z.object({
  format: z.literal(DESIGN_TEMPLATE_FORMAT),
  title: z.string().trim().max(200).optional(),
  locale: z.enum(['ka', 'en']).default('ka'),
  page: z.object({
    widthMm: z.number().min(10).max(MAX_PAGE_MM),
    heightMm: z.number().min(10).max(MAX_PAGE_MM),
    // Print bleed around the page edge (exported, not shown as page area).
    bleedMm: z.number().min(0).max(10).default(0),
    background: hexColor.default('#ffffff'),
  }),
  // Informational list of fonts the template uses; the validator does not
  // require it to be complete because each text element names its own font.
  fonts: z.array(z.enum(DESIGN_FONT_FAMILIES)).max(DESIGN_FONT_FAMILIES.length).optional(),
  pages: z.array(designPageSchema).min(1).max(MAX_PAGES),
}).superRefine((template, ctx) => {
  const seen = new Set<string>();
  template.pages.forEach((page, index) => {
    if (seen.has(page.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pages', index, 'id'], message: `Duplicate page id "${page.id}"` });
    }
    seen.add(page.id);
  });
});

export type DesignTemplate = z.infer<typeof designTemplateSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;

// Serialized JSON larger than this is refused — a CV or invitation is a few
// KB; 1.5 MB leaves room for a 30-page planner without letting a client park
// arbitrary data in the DB.
export const MAX_DESIGN_JSON_BYTES = 1_500_000;

export const createDesignSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
});

export const saveDesignSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  data: designTemplateSchema,
});

export const exportDesignSvgSchema = z.object({
  data: designTemplateSchema,
  pageIndex: z.number().int().min(0).max(MAX_PAGES - 1),
  transparent: z.boolean().default(false),
});
