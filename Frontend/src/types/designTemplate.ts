// ============================================================
// "cdc-template/1" — the editable design document format.
// TypeScript mirror of Backend/src/schemas/designTemplateSchemas.ts (the
// server validates every save against that Zod schema; keep the two in
// sync). Geometry is in millimetres from the page's top-left corner; x/y/w/h
// is the box before rotation, rotation (degrees) turns it around its centre.
// ============================================================

export const DESIGN_TEMPLATE_FORMAT = 'cdc-template/1';

export const DESIGN_FONT_FAMILIES = [
  'FiraGO',
  'Noto Sans Georgian',
  'Noto Serif Georgian',
  'Google Sans',
  'Literata',
] as const;
export type DesignFontFamily = (typeof DESIGN_FONT_FAMILIES)[number];

interface BaseElement {
  id: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotation?: number;
  opacity?: number;
  editable?: boolean;
  locked?: boolean;
  label?: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: DesignFontFamily;
  fontSizePt: number;
  fontWeight?: 400 | 700;
  italic?: boolean;
  underline?: boolean;
  color: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  fit?: 'cover' | 'contain';
  clip?: 'rect' | 'circle';
  placeholder?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill?: string | null;
  stroke?: string | null;
  strokeWidthMm?: number;
  radiusMm?: number;
}

export type DesignElement = TextElement | ImageElement | ShapeElement;

export type PageBackground = string | { imageUrl: string; color?: string };

export interface DesignPage {
  id: string;
  background?: PageBackground;
  elements: DesignElement[];
}

export interface DesignTemplate {
  format: typeof DESIGN_TEMPLATE_FORMAT;
  title?: string;
  locale?: 'ka' | 'en';
  page: { widthMm: number; heightMm: number; bleedMm?: number; background?: string };
  fonts?: DesignFontFamily[];
  pages: DesignPage[];
}
