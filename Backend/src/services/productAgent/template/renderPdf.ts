/**
 * Product agent — renders a cdc-template/1 document to a print-ready PDF.
 * Exports: renderTemplatePdf, ImageResolver.
 *
 * Text is typeset here with embedded open-licensed fonts (FiraGO / Noto
 * Georgian, SIL OFL) so Georgian always prints correctly; image elements are
 * pre-cropped with sharp at 300 DPI. The font-fallback approach (pick a
 * face per character run) is the same one bookPdfService.ts uses.
 */
import fs from 'fs';
import sharp from 'sharp';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from 'pdf-lib';
import { CdcTemplate, ImageElement, MM_TO_PT, ShapeElement, TemplateFont, TextElement } from './types';

export type ImageResolver = (src: string) => Promise<Buffer>;

const fontPath = (pkg: string, base: string, weight: 400 | 700) =>
  require.resolve(`@fontsource/${pkg}/files/${base}-${weight}-normal.woff`);

// Each family is a chain of files tried per character: the Noto families
// ship Georgian and Latin as separate subset files.
const FAMILY_FILES: Record<TemplateFont, Array<[string, string]>> = {
  FiraGO: [['firago', 'firago-latin']],
  'Noto Sans Georgian': [
    ['noto-sans-georgian', 'noto-sans-georgian-georgian'],
    ['noto-sans-georgian', 'noto-sans-georgian-latin'],
    ['noto-sans-georgian', 'noto-sans-georgian-latin-ext'],
    ['noto-sans-georgian', 'noto-sans-georgian-symbols'],
  ],
  'Noto Serif Georgian': [
    ['noto-serif-georgian', 'noto-serif-georgian-georgian'],
    ['noto-serif-georgian', 'noto-serif-georgian-latin'],
    ['noto-serif-georgian', 'noto-serif-georgian-latin-ext'],
  ],
};
// Last resort for symbols a family lacks (checkboxes, arrows, ...).
const FALLBACK_FILES: Array<[string, string]> = [
  ['firago', 'firago-latin'],
  ['noto-sans-georgian', 'noto-sans-georgian-symbols'],
  ['noto-sans-georgian', 'noto-sans-georgian-math'],
];

const fileCache = new Map<string, { bytes: Buffer; covers: (cp: number) => boolean }>();
function loadFile(path: string) {
  let entry = fileCache.get(path);
  if (!entry) {
    const bytes = fs.readFileSync(path);
    const parsed: any = fontkit.create(bytes);
    entry = { bytes, covers: (cp: number) => Boolean(parsed.hasGlyphForCodePoint(cp)) };
    fileCache.set(path, entry);
  }
  return entry;
}

interface Face {
  font: PDFFont;
  covers: (cp: number) => boolean;
}

class FontBook {
  private embedded = new Map<string, Face>();
  constructor(private doc: PDFDocument) {}

  private async face(pkg: string, base: string, weight: 400 | 700): Promise<Face> {
    const path = fontPath(pkg, base, weight);
    let f = this.embedded.get(path);
    if (!f) {
      const file = loadFile(path);
      f = { font: await this.doc.embedFont(file.bytes, { subset: true }), covers: file.covers };
      this.embedded.set(path, f);
    }
    return f;
  }

  async chain(family: TemplateFont, weight: 400 | 700): Promise<Face[]> {
    const out: Face[] = [];
    for (const [pkg, base] of [...FAMILY_FILES[family], ...FALLBACK_FILES]) out.push(await this.face(pkg, base, weight));
    return out;
  }
}

interface Run {
  text: string;
  font: PDFFont;
}

function splitRuns(text: string, chain: Face[]): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 32;
    const face = /\s/.test(ch) && runs.length ? null : chain.find((f) => f.covers(cp)) ?? chain[0];
    const font = face ? face.font : runs[runs.length - 1].font;
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += ch;
    else runs.push({ text: ch, font });
  }
  return runs;
}

const runsWidth = (runs: Run[], size: number) => runs.reduce((s, r) => s + r.font.widthOfTextAtSize(r.text, size), 0);

function wrap(text: string, maxWidth: number, size: number, chain: Face[]): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/ +/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && runsWidth(splitRuns(candidate, chain), size) > maxWidth) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    lines.push(current);
  }
  return lines;
}

function hex(color: string | null | undefined, fallback = '#000000'): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec((color || fallback).trim()) || /^#?([0-9a-f]{6})$/i.exec(fallback)!;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function drawText(page: PDFPage, el: TextElement, pageH: number, fonts: FontBook): Promise<void> {
  const chain = await fonts.chain(el.fontFamily, (el.fontWeight ?? 400) >= 600 ? 700 : 400);
  const boxW = el.wMm * MM_TO_PT;
  const boxH = el.hMm * MM_TO_PT;
  const lh = el.lineHeight ?? 1.25;
  // Shrink until the text fits its box (down to 55% of the set size) — the
  // AI writes the words, so a longer-than-planned line must not overflow.
  let size = el.fontSizePt;
  let lines = wrap(el.text, boxW, size, chain);
  while (size > el.fontSizePt * 0.55 && (lines.length * size * lh > boxH + size * 0.3 || lines.some((l) => runsWidth(splitRuns(l, chain), size) > boxW))) {
    size *= 0.94;
    lines = wrap(el.text, boxW, size, chain);
  }
  const color = hex(el.color, '#1a1a1a');
  const left = el.xMm * MM_TO_PT;
  let baseline = pageH - el.yMm * MM_TO_PT - size * 0.9;
  for (const line of lines) {
    const runs = splitRuns(line, chain);
    const w = runsWidth(runs, size);
    let x = el.align === 'center' ? left + (boxW - w) / 2 : el.align === 'right' ? left + boxW - w : left;
    for (const r of runs) {
      page.drawText(r.text, { x, y: baseline, size, font: r.font, color });
      x += r.font.widthOfTextAtSize(r.text, size);
    }
    baseline -= size * lh;
  }
}

function drawShape(page: PDFPage, el: ShapeElement, pageH: number): void {
  const x = el.xMm * MM_TO_PT;
  const yTop = pageH - el.yMm * MM_TO_PT;
  const w = el.wMm * MM_TO_PT;
  const h = el.hMm * MM_TO_PT;
  const opacity = el.opacity ?? 1;
  const borderWidth = (el.strokeWidthMm ?? 0) * MM_TO_PT;
  const dash = el.dashMm ? [el.dashMm * MM_TO_PT, el.dashMm * MM_TO_PT] : undefined;
  const fill = el.fill ? hex(el.fill) : undefined;
  const stroke = el.stroke && borderWidth > 0 ? hex(el.stroke) : undefined;
  if (el.shape === 'line') {
    // The box is the line (editor semantics): stroke along its long axis.
    const color = hex(el.stroke ?? el.fill ?? '#000000');
    const thickness = borderWidth || Math.min(w, h);
    if (w >= h) page.drawLine({ start: { x, y: yTop - h / 2 }, end: { x: x + w, y: yTop - h / 2 }, thickness, color, opacity, dashArray: dash });
    else page.drawLine({ start: { x: x + w / 2, y: yTop }, end: { x: x + w / 2, y: yTop - h }, thickness, color, opacity, dashArray: dash });
  } else if (el.shape === 'ellipse') {
    page.drawEllipse({ x: x + w / 2, y: yTop - h / 2, xScale: w / 2, yScale: h / 2, color: fill, borderColor: stroke, borderWidth, opacity, borderOpacity: opacity, borderDashArray: dash });
  } else if (el.radiusMm && el.radiusMm > 0) {
    const r = Math.min(el.radiusMm * MM_TO_PT, w / 2, h / 2);
    const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(path, { x, y: yTop, color: fill, borderColor: stroke, borderWidth, opacity, borderOpacity: opacity, borderDashArray: dash });
  } else {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: fill, borderColor: stroke, borderWidth, opacity, borderOpacity: opacity, borderDashArray: dash });
  }
}

async function drawImage(doc: PDFDocument, page: PDFPage, el: ImageElement, pageH: number, resolve: ImageResolver): Promise<void> {
  const source = await resolve(el.src);
  // 300 DPI of the box, capped so a full-page picture stays a sane size.
  const scale = Math.min(300 / 25.4, 3600 / Math.max(el.wMm, el.hMm));
  const pxW = Math.max(1, Math.round(el.wMm * scale));
  const pxH = Math.max(1, Math.round(el.hMm * scale));
  const pipeline = sharp(source).resize(pxW, pxH, { fit: el.fit === 'contain' ? 'contain' : 'cover', background: { r: 255, g: 255, b: 255, alpha: 0 } });
  let image;
  if (el.clip === 'circle') {
    const mask = Buffer.from(`<svg width="${pxW}" height="${pxH}"><ellipse cx="${pxW / 2}" cy="${pxH / 2}" rx="${pxW / 2}" ry="${pxH / 2}" fill="#fff"/></svg>`);
    image = await doc.embedPng(await pipeline.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer());
  } else {
    const meta = await sharp(source).metadata();
    // "contain" pads with transparency, which JPEG would turn black.
    image = meta.hasAlpha || el.fit === 'contain' ? await doc.embedPng(await pipeline.png().toBuffer()) : await doc.embedJpg(await pipeline.jpeg({ quality: 92 }).toBuffer());
  }
  page.drawImage(image, { x: el.xMm * MM_TO_PT, y: pageH - (el.yMm + el.hMm) * MM_TO_PT, width: el.wMm * MM_TO_PT, height: el.hMm * MM_TO_PT, opacity: el.opacity ?? 1 });
}

export async function renderTemplatePdf(template: CdcTemplate, resolve: ImageResolver): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(template.title);
  doc.setCreator('CDC Studio');
  doc.setProducer('cdc.org.ge');
  const fonts = new FontBook(doc);
  const W = template.page.widthMm * MM_TO_PT;
  const H = template.page.heightMm * MM_TO_PT;
  for (const tp of template.pages) {
    const page = doc.addPage([W, H]);
    const bg = typeof tp.background === 'string' ? tp.background : template.page.background;
    if (bg && bg.toLowerCase() !== '#ffffff' && bg.toLowerCase() !== '#fff') page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hex(bg) });
    if (tp.background && typeof tp.background === 'object') {
      await drawImage(doc, page, { id: 'bg', type: 'image', src: tp.background.imageUrl, xMm: 0, yMm: 0, wMm: template.page.widthMm, hMm: template.page.heightMm, fit: 'cover' }, H, resolve);
    }
    for (const el of tp.elements) {
      if (el.type === 'text') await drawText(page, el, H, fonts);
      else if (el.type === 'shape') drawShape(page, el, H);
      else await drawImage(doc, page, el, H, resolve);
    }
  }
  return Buffer.from(await doc.save());
}
