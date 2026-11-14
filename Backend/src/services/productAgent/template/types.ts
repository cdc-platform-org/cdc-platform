/**
 * Product agent — the "cdc-template/1" document model.
 * Exports: CdcTemplate, TemplatePage, TemplateElement, TextElement, ImageElement,
 * ShapeElement, TemplateFont, TEMPLATE_FONTS, MM_TO_PT.
 *
 * Every editable product (planners, worksheets, CV, invitations, business
 * templates, exam prep) is first built as one of these, then rendered to a
 * PDF (./renderPdf.ts) and also shipped as JSON so buyers can edit it in
 * the platform's own template editor. The format was agreed with the
 * editor work: geometry in mm from the page's top-left, z-order = array
 * order, text is always real text (never baked into an image), only the
 * fonts below, stable element ids, images as https URLs on our storage.
 */

export const TEMPLATE_FONTS = ['FiraGO', 'Noto Sans Georgian', 'Noto Serif Georgian'] as const;
export type TemplateFont = (typeof TEMPLATE_FONTS)[number];

export const MM_TO_PT = 72 / 25.4;

interface BaseElement {
  id: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotation?: number;
  editable?: boolean;
  locked?: boolean;
  label?: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: TemplateFont;
  fontSizePt: number;
  fontWeight?: 400 | 700;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  // https URL once published. While the agent is still building a product
  // it may hold an "asset:<key>" reference that is resolved from an
  // in-memory buffer map and swapped for the uploaded URL before saving.
  src: string;
  fit?: 'cover' | 'contain';
  clip?: 'rect' | 'circle';
  placeholder?: boolean;
  opacity?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill?: string | null;
  stroke?: string | null;
  strokeWidthMm?: number;
  radiusMm?: number;
  opacity?: number;
  // Not in the agreed format's examples but harmless to an editor that
  // ignores it: dashed strokes for tracing guides and cut lines.
  dashMm?: number;
}

export type TemplateElement = TextElement | ImageElement | ShapeElement;

export interface TemplatePage {
  id: string;
  background?: string | { imageUrl: string };
  elements: TemplateElement[];
}

export interface CdcTemplate {
  format: 'cdc-template/1';
  title: string;
  locale: 'ka' | 'en';
  page: { widthMm: number; heightMm: number; bleedMm: number; background: string };
  fonts: TemplateFont[];
  pages: TemplatePage[];
}
