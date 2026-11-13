/**
 * Product agent — pieces every generator shares: the generator signature,
 * small layout helpers for cdc-template/1 pages, and the common
 * "template → PDF + JSON + mockups → ProductDraft" assembly.
 * Exports: GeneratorContext, Generator, Layout, buildDocumentProduct, DocumentFileSpec,
 * hexColor, slug, LANGS.
 */
import crypto from 'crypto';
import { RunCost } from '../ai';
import { ThemeContext } from '../themes';
import { ProductDraft, DraftFile } from '../publish';
import { AgentCategoryKey } from '../categories';
import { CdcTemplate, ImageElement, ShapeElement, TemplateElement, TemplateFont, TextElement } from '../template/types';
import { renderTemplatePdf } from '../template/renderPdf';
import { renderPdfPages } from '../files';
import { flatLayMockup } from '../mockups';
import { uploadImage } from '../../integrations/imageStorage';

export interface GeneratorContext {
  cost: RunCost;
  quality: 'high' | 'medium';
  theme: ThemeContext;
  category: AgentCategoryKey;
  priceGel: number;
}

export type Generator = (ctx: GeneratorContext) => Promise<ProductDraft>;

export const LANGS = ['ka', 'en'] as const;

export const hexColor = (v: string | undefined, fallback: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'cdc';

// Tiny builder so page layouts read as a list of boxes instead of literals.
export class Layout {
  elements: TemplateElement[] = [];
  private n = 0;
  constructor(private prefix: string, private defaultFont: TemplateFont = 'FiraGO') {}
  private id(kind: string) {
    this.n += 1;
    return `${this.prefix}-${kind}-${this.n}`;
  }
  text(x: number, y: number, w: number, h: number, text: string, o: Partial<TextElement> = {}): this {
    this.elements.push({
      id: o.id ?? this.id('text'),
      type: 'text',
      xMm: x, yMm: y, wMm: w, hMm: h,
      text,
      fontFamily: o.fontFamily ?? this.defaultFont,
      fontSizePt: o.fontSizePt ?? 11,
      fontWeight: o.fontWeight ?? 400,
      italic: false,
      color: o.color ?? '#1f2328',
      align: o.align ?? 'left',
      lineHeight: o.lineHeight ?? 1.3,
      letterSpacing: 0,
      editable: o.editable ?? true,
      locked: o.locked ?? false,
      ...(o.label ? { label: o.label } : {}),
    });
    return this;
  }
  rect(x: number, y: number, w: number, h: number, o: Partial<ShapeElement> = {}): this {
    this.elements.push({ id: o.id ?? this.id('shape'), type: 'shape', shape: o.shape ?? 'rect', xMm: x, yMm: y, wMm: w, hMm: h, fill: o.fill ?? null, stroke: o.stroke ?? null, strokeWidthMm: o.strokeWidthMm ?? 0, radiusMm: o.radiusMm ?? 0, opacity: o.opacity ?? 1, editable: false, locked: true, ...(o.dashMm ? { dashMm: o.dashMm } : {}) });
    return this;
  }
  line(x: number, y: number, w: number, h: number, color = '#c9ccd1', widthMm = 0.25, dashMm?: number): this {
    return this.rect(x, y, w, h, { shape: 'line', stroke: color, strokeWidthMm: widthMm, dashMm });
  }
  image(x: number, y: number, w: number, h: number, src: string, o: Partial<ImageElement> = {}): this {
    this.elements.push({ id: o.id ?? this.id('image'), type: 'image', xMm: x, yMm: y, wMm: w, hMm: h, src, fit: o.fit ?? 'cover', clip: o.clip ?? 'rect', placeholder: o.placeholder ?? false, editable: o.editable ?? true, ...(o.opacity != null ? { opacity: o.opacity } : {}) });
    return this;
  }
}

export interface DocumentFileSpec {
  template: CdcTemplate;
  fileBase: string;
}

// Generated pictures referenced from templates as "asset:<key>" are uploaded
// once to public storage (the editor loads them by URL) and the template
// JSON is rewritten to those URLs before it is shipped.
async function uploadTemplateAssets(templates: CdcTemplate[], assets: Map<string, Buffer>): Promise<CdcTemplate[]> {
  const urls = new Map<string, string>();
  for (const [key, buffer] of assets) {
    urls.set(`asset:${key}`, await uploadImage({ buffer, mimetype: 'image/png', folderName: 'product-agent-templates', filename: `tpl-${Date.now()}-${crypto.randomUUID()}.png` }));
  }
  const swap = (src: string) => urls.get(src) ?? src;
  return templates.map((t) => ({
    ...t,
    pages: t.pages.map((p) => ({
      ...p,
      background: p.background && typeof p.background === 'object' ? { imageUrl: swap(p.background.imageUrl) } : p.background,
      elements: p.elements.map((e) => (e.type === 'image' ? { ...e, src: swap(e.src) } : e)),
    })),
  }));
}

// Renders every template to a PDF, builds the store mockups from the first
// file's pages, and returns the files (PDF + editable JSON per template).
export async function buildDocumentProduct(
  ctx: GeneratorContext,
  specs: DocumentFileSpec[],
  assets: Map<string, Buffer>,
  opts: { includeJson: boolean }
): Promise<{ files: DraftFile[]; cover: Buffer; gallery: Buffer[]; pageCounts: number[] }> {
  const resolve = async (src: string) => {
    if (src.startsWith('asset:')) {
      const b = assets.get(src.slice(6));
      if (!b) throw new Error(`Missing generated asset ${src}`);
      return b;
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  };
  const files: DraftFile[] = [];
  const renders: Buffer[][] = [];
  for (const spec of specs) {
    const pdf = await renderTemplatePdf(spec.template, resolve);
    files.push({ buffer: pdf, name: `${spec.fileBase}.pdf`, mimetype: 'application/pdf' });
    renders.push(await renderPdfPages(pdf, Math.min(4, spec.template.pages.length)));
  }
  if (opts.includeJson) {
    const finalTemplates = await uploadTemplateAssets(specs.map((s) => s.template), assets);
    finalTemplates.forEach((t, i) => {
      files.push({ buffer: Buffer.from(JSON.stringify(t, null, 2)), name: `${specs[i].fileBase}.cdc-template.json`, mimetype: 'application/json' });
    });
  }
  const firstPages = renders.flatMap((r) => r.slice(0, 1));
  const coverPages = renders[0].length >= 3 ? renders[0].slice(0, 3) : [...renders[0], ...firstPages.slice(1)].slice(0, 3);
  const cover = await flatLayMockup(ctx.cost, coverPages);
  const gallery: Buffer[] = [];
  for (const page of renders.flat().slice(0, 4)) gallery.push(await flatLayMockup(ctx.cost, [page]));
  return { files, cover, gallery, pageCounts: specs.map((s) => s.template.pages.length) };
}

export function newTemplate(title: string, locale: 'ka' | 'en', widthMm: number, heightMm: number, fonts: TemplateFont[] = ['FiraGO']): CdcTemplate {
  return { format: 'cdc-template/1', title, locale, page: { widthMm, heightMm, bleedMm: 0, background: '#ffffff' }, fonts, pages: [] };
}
