import { PDFDocument, rgb, PDFFont, PDFPage, PDFImage, RGB } from 'pdf-lib';
import sharp from 'sharp';
import QRCode from 'qrcode';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { isAllowedPageCount } from './bookStateService';
import { BOOK_FONTS, BookFontChoice, BookFontFace, BookFontId, FALLBACK_BOOK_FONTS, resolveBookFont } from './bookFonts';

// ============================================================
// Children's Book — final PDF assembly, laid out like a real picture book:
//   1. front cover: full-bleed cover art, title, "a story starring <hero>"
//   2. title page: hero portrait, title, dedication, short introduction
//   3. one page per purchased story page (exactly the book's pageCount,
//      5/10/15/20 — the exact-page-count invariant still holds for the
//      story pages): illustration, large text, page number, small site link
//   4. back cover: introduction, QR "listen to this book" (when narrated
//      and shared), QR "create your own book", site name.
// Images are re-encoded to JPEG at print resolution and cropped to their
// box with sharp, which also keeps the file a few MB instead of ~25 MB.
//
// Mixed Georgian/Latin text: each character is drawn with the parent's
// chosen font for its script (bookFonts.ts), falling back to the next face
// that has the glyph; consecutive characters with the same face form one
// run.
// ============================================================

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MM_TO_PT = 72 / 25.4;

// ============================================================
// Print sizes. The stored PDF is always A4 portrait; a parent can also
// download a print-ready copy at another size (built on demand from the
// same pages, no image cost). Custom sizes are limited to what a print shop
// can reasonably produce. Bleed adds an extra edge around every page for
// professional printing; the TrimBox marks the final cut size.
// ============================================================
export const PRINT_SIZE_PRESETS = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A3: { widthMm: 297, heightMm: 420 },
  LETTER: { widthMm: 215.9, heightMm: 279.4 },
  SQUARE_210: { widthMm: 210, heightMm: 210 },
  SQUARE_200: { widthMm: 200, heightMm: 200 },
} as const;
export type PrintSizePreset = keyof typeof PRINT_SIZE_PRESETS;
export const CUSTOM_PRINT_SIZE_MIN_MM = 90;
export const CUSTOM_PRINT_SIZE_MAX_MM = 500;
export const ALLOWED_BLEED_MM = [0, 3, 5] as const;

export interface PrintSettings {
  size: PrintSizePreset | 'CUSTOM';
  orientation: 'portrait' | 'landscape';
  widthMm: number; // final (trim) size, orientation already applied
  heightMm: number;
  bleedMm: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = { size: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297, bleedMm: 0 };

export function parsePrintSettings(raw: any): { ok: true; value: PrintSettings } | { ok: false; message: string } {
  const size = raw?.size ?? 'A4';
  const orientation = raw?.orientation === 'landscape' ? 'landscape' : 'portrait';
  if (raw?.orientation !== undefined && raw.orientation !== 'portrait' && raw.orientation !== 'landscape') {
    return { ok: false, message: 'Orientation must be portrait or landscape.' };
  }
  const bleedMm = raw?.bleedMm === undefined ? 0 : Number(raw.bleedMm);
  if (!(ALLOWED_BLEED_MM as readonly number[]).includes(bleedMm)) return { ok: false, message: 'Bleed must be 0, 3 or 5 mm.' };

  let widthMm: number;
  let heightMm: number;
  if (size === 'CUSTOM') {
    widthMm = Number(raw?.widthMm);
    heightMm = Number(raw?.heightMm);
    const inRange = (v: number) => Number.isFinite(v) && v >= CUSTOM_PRINT_SIZE_MIN_MM && v <= CUSTOM_PRINT_SIZE_MAX_MM;
    if (!inRange(widthMm) || !inRange(heightMm)) {
      return { ok: false, message: `Custom size must be between ${CUSTOM_PRINT_SIZE_MIN_MM} and ${CUSTOM_PRINT_SIZE_MAX_MM} mm on each side.` };
    }
    widthMm = Math.round(widthMm * 10) / 10;
    heightMm = Math.round(heightMm * 10) / 10;
    return { ok: true, value: { size, orientation: widthMm > heightMm ? 'landscape' : 'portrait', widthMm, heightMm, bleedMm } };
  }
  if (!Object.prototype.hasOwnProperty.call(PRINT_SIZE_PRESETS, size)) return { ok: false, message: 'Unknown paper size.' };
  const preset = PRINT_SIZE_PRESETS[size as PrintSizePreset];
  const portrait = { w: Math.min(preset.widthMm, preset.heightMm), h: Math.max(preset.widthMm, preset.heightMm) };
  widthMm = orientation === 'landscape' ? portrait.h : portrait.w;
  heightMm = orientation === 'landscape' ? portrait.w : portrait.h;
  return { ok: true, value: { size: size as PrintSizePreset, orientation, widthMm, heightMm, bleedMm } };
}

export function printFileSuffix(settings: PrintSettings): string {
  const base = settings.size === 'CUSTOM' ? `${settings.widthMm}x${settings.heightMm}mm` : `${settings.size}${settings.widthMm === settings.heightMm ? '' : `-${settings.orientation}`}`;
  return settings.bleedMm ? `${base}-bleed${settings.bleedMm}mm` : base;
}

const GEORGIAN_RANGE = /[\u10A0-\u10FF\u1C90-\u1CBF\u2D00-\u2D2F]/;

// One embedded typeface (regular + bold) and which characters it can draw.
interface Face {
  regular: PDFFont;
  bold: PDFFont;
  covers: (codePoint: number) => boolean;
}

// The chosen font for each script, then fallbacks, so a character the
// chosen face lacks is drawn by the next face that has it instead of an
// empty box.
interface Fonts {
  georgianChain: Face[];
  latinChain: Face[];
}

interface Run {
  text: string;
  face: Face;
}

// Font files are read once per process; they never change at runtime.
const fontFileCache = new Map<string, { bytes: Buffer; covers: (codePoint: number) => boolean }>();
function loadFontFile(path: string) {
  let entry = fontFileCache.get(path);
  if (!entry) {
    const bytes = fs.readFileSync(path);
    const parsed: any = fontkit.create(bytes);
    entry = { bytes, covers: (cp: number) => Boolean(parsed.hasGlyphForCodePoint(cp)) };
    fontFileCache.set(path, entry);
  }
  return entry;
}

async function embedFonts(doc: PDFDocument, fontId: BookFontId): Promise<Fonts> {
  const choice: BookFontChoice = BOOK_FONTS[fontId];
  const embedded = new Map<string, Face>();
  const embedFace = async (f: BookFontFace): Promise<Face> => {
    const existing = embedded.get(f.regular);
    if (existing) return existing;
    const regular = loadFontFile(f.regular);
    const bold = loadFontFile(f.bold);
    const result: Face = {
      regular: await doc.embedFont(regular.bytes, { subset: true }),
      bold: await doc.embedFont(bold.bytes, { subset: true }),
      covers: regular.covers,
    };
    embedded.set(f.regular, result);
    return result;
  };
  const chain = async (faces: BookFontFace[]) => {
    const out: Face[] = [];
    for (const f of faces) {
      const e = await embedFace(f);
      if (!out.includes(e)) out.push(e);
    }
    return out;
  };
  return {
    georgianChain: await chain([choice.georgian, choice.latin, ...FALLBACK_BOOK_FONTS]),
    latinChain: await chain([choice.latin, choice.georgian, ...FALLBACK_BOOK_FONTS]),
  };
}

function faceForChar(fonts: Fonts, ch: string): Face {
  const chain = GEORGIAN_RANGE.test(ch) ? fonts.georgianChain : fonts.latinChain;
  const cp = ch.codePointAt(0) ?? 32;
  return chain.find((f) => f.covers(cp)) ?? chain[0];
}

function splitFontRuns(text: string, fonts: Fonts): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    // Spaces stay with the run they are in, so a line is not split into
    // a run per word.
    const face = /\s/.test(ch) && runs.length ? runs[runs.length - 1].face : faceForChar(fonts, ch);
    const last = runs[runs.length - 1];
    if (last && last.face === face) last.text += ch;
    else runs.push({ text: ch, face });
  }
  return runs;
}

function fontFor(face: Face, bold: boolean): PDFFont {
  return bold ? face.bold : face.regular;
}

function widthOfRuns(runs: Run[], size: number, bold: boolean): number {
  return runs.reduce((sum, run) => sum + fontFor(run.face, bold).widthOfTextAtSize(run.text, size), 0);
}

// Greedy word-wrap across mixed-script runs, wrapping on spaces only
// (sufficient for the short story-text paragraphs this product writes).
function wrapText(text: string, maxWidth: number, size: number, fonts: Fonts, bold: boolean): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = widthOfRuns(splitFontRuns(candidate, fonts), size, bold);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawMixedLine(page: PDFPage, line: string, x: number, y: number, size: number, fonts: Fonts, bold: boolean, color = rgb(0.15, 0.1, 0.05)): void {
  let cursorX = x;
  for (const run of splitFontRuns(line, fonts)) {
    const font = fontFor(run.face, bold);
    page.drawText(run.text, { x: cursorX, y, size, font, color });
    cursorX += font.widthOfTextAtSize(run.text, size);
  }
}

function drawCenteredMixedLine(page: PDFPage, line: string, centerX: number, y: number, size: number, fonts: Fonts, bold: boolean, color = rgb(0.15, 0.1, 0.05)): void {
  const width = widthOfRuns(splitFontRuns(line, fonts), size, bold);
  drawMixedLine(page, line, centerX - width / 2, y, size, fonts, bold, color);
}

export interface BookPdfPageInput {
  pageNumber: number;
  storyText: string;
  imageBuffer: Buffer | null;
  imageMimeType: string | null;
}

export interface BookPdfImage {
  buffer: Buffer;
  mimeType: string;
}

export interface BookPdfInput {
  title: string;
  dedication: string | null;
  pageCount: number; // the purchased book's own pageCount — 5/10/15/20 story pages
  pages: BookPdfPageInput[];
  print?: PrintSettings; // default A4 portrait, no bleed
  fontId?: string | null; // a BOOK_FONTS key; unknown/missing = the default font
  language?: 'KA' | 'EN' | string | null;
  heroName?: string | null;
  blurb?: string | null; // short introduction (title page + back cover)
  cover?: BookPdfImage | null; // front cover art; falls back to page 1's picture
  portrait?: BookPdfImage | null; // approved hero portrait for the title page
  listenUrl?: string | null; // QR to the public page of this book
  listenHasAudio?: boolean; // the QR caption says "listen" instead of "read online"
  createUrl?: string | null; // QR "create your own book"
  siteLabel?: string | null; // small link printed on every page
}

export class InvalidBookPdfPageCountError extends Error {
  constructor(expected: number, actual: number) {
    super(`Book PDF invariant violated: expected exactly ${expected} story pages, got ${actual}.`);
    this.name = 'InvalidBookPdfPageCountError';
  }
}

// Front cover + title page + back cover around the story pages.
export const BOOK_PDF_EXTRA_PAGES = 3;

const LABELS = {
  KA: {
    starring: (name: string) => `ზღაპარი, რომლის მთავარი გმირია ${name}`,
    belongsTo: 'ეს წიგნი ეკუთვნის',
    intro: 'შესავალი',
    listen: 'მოუსმინე ამ ზღაპარს',
    read: 'წაიკითხე ონლაინ',
    listenHint: 'დაასკანერე ტელეფონით',
    create: 'შექმენი შენი წიგნი',
    createHint: 'შენი შვილი — ზღაპრის გმირი',
    madeWith: 'შექმნილია CDC-ს AI საბავშვო წიგნით',
  },
  EN: {
    starring: (name: string) => `A story starring ${name}`,
    belongsTo: 'This book belongs to',
    intro: 'About this book',
    listen: 'Listen to this story',
    read: 'Read it online',
    listenHint: 'Scan with your phone',
    create: 'Create your own book',
    createHint: 'Your child as the hero',
    madeWith: 'Made with the CDC AI children\'s book creator',
  },
} as const;

const INK = rgb(0.16, 0.12, 0.2);
const MUTED = rgb(0.45, 0.42, 0.5);
const CREAM = rgb(1, 0.985, 0.955);
const PLUM = rgb(0.29, 0.16, 0.47);
const WHITE = rgb(1, 1, 1);

// Pixels per PDF point for embedded pictures: ~216 dpi, sharp in print
// without bloating the file.
const PX_PER_PT = 3;

// Crops a picture to exactly fill a w×h box (like CSS object-fit: cover)
// and re-encodes it as JPEG. null if the bytes aren't a readable image.
async function preparePicture(doc: PDFDocument, image: BookPdfImage | null | undefined, w: number, h: number): Promise<PDFImage | null> {
  if (!image?.buffer?.length) return null;
  try {
    const width = Math.max(16, Math.min(2400, Math.round(w * PX_PER_PT)));
    const height = Math.max(16, Math.min(2400, Math.round(h * PX_PER_PT)));
    const jpeg = await sharp(image.buffer).rotate().resize(width, height, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return await doc.embedJpg(jpeg);
  } catch {
    return null;
  }
}

async function qrImage(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#2a1a40', light: '#ffffff' } });
    return await doc.embedPng(png);
  } catch {
    return null;
  }
}

export async function buildBookPdf(input: BookPdfInput): Promise<Buffer> {
  if (!isAllowedPageCount(input.pageCount) || input.pages.length !== input.pageCount) {
    throw new InvalidBookPdfPageCountError(input.pageCount, input.pages.length);
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(input.title);
  doc.setCreator('CDC — cdc.org.ge');
  const fonts = await embedFonts(doc, resolveBookFont(input.fontId));
  const labels = input.language === 'EN' ? LABELS.EN : LABELS.KA;

  const sorted = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const print = input.print ?? DEFAULT_PRINT_SETTINGS;
  const trimW = print.widthMm * MM_TO_PT;
  const trimH = print.heightMm * MM_TO_PT;
  const bleed = print.bleedMm * MM_TO_PT;
  const fullW = trimW + 2 * bleed;
  const fullH = trimH + 2 * bleed;
  // Type, margins and spacing scale with the page so a small or large print
  // keeps the same proportions as the A4 original (compared with A4 in the
  // same orientation, so a landscape page is not treated as a tiny one).
  const scale = Math.min(Math.max(trimW, trimH) / A4_HEIGHT, Math.min(trimW, trimH) / A4_WIDTH);
  const typeScale = Math.max(0.6, Math.min(scale, 1.4));
  const margin = Math.max(18, 48 * Math.min(scale, 1.4));
  const landscape = trimW > trimH * 1.15;
  const siteLabel = input.siteLabel ?? 'cdc.org.ge';

  const newPage = (background?: RGB) => {
    const page = doc.addPage([fullW, fullH]);
    if (bleed) {
      page.setBleedBox(0, 0, fullW, fullH);
      page.setTrimBox(bleed, bleed, trimW, trimH);
    }
    if (background) page.drawRectangle({ x: 0, y: 0, width: fullW, height: fullH, color: background });
    return page;
  };

  // Lines of a text block shrunk until they fit `maxHeight` (never below a
  // readable minimum).
  const fitLines = (content: string, size: number, bold: boolean, maxWidth: number, maxHeight: number, lineGap = 1.45) => {
    let current = size;
    let lines = wrapText(content, maxWidth, current, fonts, bold);
    while (current > 7 && lines.length * current * lineGap > maxHeight) {
      current -= 0.5;
      lines = wrapText(content, maxWidth, current, fonts, bold);
    }
    return { size: current, lines, height: lines.length * current * lineGap, lineGap };
  };
  // Draws centred lines from `top` downwards (PDF y grows upwards). Returns
  // the y below the block.
  const drawLines = (page: PDFPage, block: ReturnType<typeof fitLines>, centerX: number, top: number, bold: boolean, color: RGB) => {
    let y = top - block.size;
    for (const line of block.lines) {
      drawCenteredMixedLine(page, line, centerX, y, block.size, fonts, bold, color);
      y -= block.size * block.lineGap;
    }
    return top - block.height;
  };
  const paragraphs = (content: string) => content.split(/\n+/).map((part) => part.trim()).filter(Boolean).join(' ');
  const footer = (page: PDFPage, pageNumber: number | null, color: RGB = MUTED) => {
    const y = bleed + Math.max(12, margin * 0.42);
    if (pageNumber !== null) drawCenteredMixedLine(page, String(pageNumber), bleed + trimW / 2, y, 10 * typeScale, fonts, false, color);
    drawMixedLine(page, siteLabel, bleed + margin, y, 7 * typeScale, fonts, false, color);
  };

  // ---------- 1. Front cover ----------
  {
    const page = newPage(PLUM);
    const art = await preparePicture(doc, input.cover ?? (sorted[0]?.imageBuffer && sorted[0].imageMimeType ? { buffer: sorted[0].imageBuffer, mimeType: sorted[0].imageMimeType } : null), fullW, fullH);
    if (art) page.drawImage(art, { x: 0, y: 0, width: fullW, height: fullH });
    // Title over a soft dark fade at the top, like a bookshop cover: big
    // white type with a faint shadow, readable on any picture.
    const titleW = trimW - 2 * margin;
    const title = fitLines(input.title, 40 * typeScale, true, titleW, trimH * 0.2, 1.2);
    const starring = input.heroName ? fitLines(labels.starring(input.heroName), 15 * typeScale, false, titleW, trimH * 0.07, 1.3) : null;
    const blockH = title.height + (starring ? starring.height + 10 * typeScale : 0);
    const fadeH = Math.min(fullH * 0.5, bleed + margin * 1.4 + blockH + margin * 1.6);
    const steps = 24;
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps; // 0 at the top edge
      page.drawRectangle({ x: 0, y: fullH - fadeH * (t + 1 / steps), width: fullW, height: fadeH / steps + 1.5, color: rgb(0.08, 0.04, 0.14), opacity: 0.62 * (1 - t) * (1 - t) });
    }
    const titleTop = bleed + trimH - margin * 1.3;
    const shadow = 1.4 * typeScale;
    drawLines(page, title, bleed + trimW / 2 + shadow, titleTop - shadow, true, rgb(0.05, 0.02, 0.1));
    const y = drawLines(page, title, bleed + trimW / 2, titleTop, true, WHITE);
    if (starring) drawLines(page, starring, bleed + trimW / 2, y - 10 * typeScale, false, rgb(1, 0.93, 0.75));
    // Small site name at the bottom edge.
    const label = siteLabel;
    const lw = widthOfRuns(splitFontRuns(label, fonts), 8 * typeScale, true);
    page.drawRectangle({ x: bleed + trimW / 2 - lw / 2 - 8 * typeScale, y: bleed + margin * 0.45 - 4 * typeScale, width: lw + 16 * typeScale, height: 8 * typeScale + 8 * typeScale, color: rgb(0, 0, 0), opacity: 0.35 });
    drawCenteredMixedLine(page, label, bleed + trimW / 2, bleed + margin * 0.45 + 0.5 * typeScale, 8 * typeScale, fonts, true, WHITE);
  }

  // ---------- 2. Title page ----------
  {
    const page = newPage(CREAM);
    const centerX = bleed + trimW / 2;
    const contentW = Math.min(trimW - 2 * margin, 420 * typeScale);
    const side = Math.min(trimW * 0.4, trimH * 0.32);
    const frame = 5 * typeScale;
    const portrait = await preparePicture(doc, input.portrait, side, side);
    // Measure first so the whole page is centred vertically.
    const belongs = input.heroName ? fitLines(labels.belongsTo, 11 * typeScale, false, contentW, 40 * typeScale) : null;
    const hero = input.heroName ? fitLines(input.heroName, 22 * typeScale, true, contentW, 60 * typeScale) : null;
    const title = fitLines(input.title, 26 * typeScale, true, contentW, 90 * typeScale, 1.25);
    const dedication = input.dedication?.trim() ? fitLines(`„${input.dedication.trim()}“`, 13 * typeScale, false, contentW, 80 * typeScale) : null;
    const gap = 16 * typeScale;
    const fixedH = (portrait ? side + 2 * frame + gap * 1.4 : 0) + (belongs && hero ? belongs.height + hero.height + gap : 0) + title.height + (dedication ? dedication.height + gap : 0);
    const maxBlurbH = Math.max(0, trimH - 2.6 * margin - fixedH - 2 * gap);
    const blurb = input.blurb?.trim() && maxBlurbH > 40 * typeScale ? fitLines(paragraphs(input.blurb), 13 * typeScale, false, contentW, maxBlurbH) : null;
    const totalH = fixedH + (blurb ? blurb.height + 2 * gap : 0);
    let top = bleed + trimH / 2 + totalH / 2 + margin * 0.2;
    if (portrait) {
      page.drawRectangle({ x: centerX - side / 2 - frame, y: top - side - 2 * frame, width: side + 2 * frame, height: side + 2 * frame, color: WHITE, borderColor: PLUM, borderWidth: 1 * typeScale, borderOpacity: 0.35 });
      page.drawImage(portrait, { x: centerX - side / 2, y: top - side - frame, width: side, height: side });
      top -= side + 2 * frame + gap * 1.4;
    }
    if (belongs && hero) {
      top = drawLines(page, belongs, centerX, top, false, MUTED) - 2 * typeScale;
      top = drawLines(page, hero, centerX, top, true, PLUM) - gap;
    }
    top = drawLines(page, title, centerX, top, true, INK);
    if (dedication) top = drawLines(page, dedication, centerX, top - gap, false, MUTED);
    if (blurb) {
      top -= gap;
      page.drawLine({ start: { x: centerX - 30 * typeScale, y: top }, end: { x: centerX + 30 * typeScale, y: top }, thickness: 1 * typeScale, color: PLUM, opacity: 0.4 });
      drawLines(page, blurb, centerX, top - gap, false, INK);
    }
    footer(page, null);
  }

  // ---------- 3. Story pages ----------
  for (const pageInput of sorted) {
    const page = newPage(CREAM);
    const body = paragraphs(pageInput.storyText ?? '');
    const picture = pageInput.imageBuffer && pageInput.imageMimeType ? { buffer: pageInput.imageBuffer, mimeType: pageInput.imageMimeType } : null;
    if (landscape) {
      // Picture fills the left half to the edge, text centred on the right.
      const imgW = bleed + trimW * 0.52;
      const art = await preparePicture(doc, picture, imgW, fullH);
      if (art) page.drawImage(art, { x: 0, y: 0, width: imgW, height: fullH });
      else page.drawRectangle({ x: 0, y: 0, width: imgW, height: fullH, color: rgb(0.93, 0.92, 0.95) });
      const textX = bleed + trimW * 0.52 + margin * 0.8;
      const textW = bleed + trimW - margin - textX;
      const block = fitLines(body, 19 * typeScale, false, textW, trimH - 2.5 * margin, 1.5);
      const top = bleed + trimH / 2 + block.height / 2;
      drawLines(page, block, textX + textW / 2, top, false, INK);
      const y = bleed + Math.max(12, margin * 0.42);
      drawCenteredMixedLine(page, String(pageInput.pageNumber), textX + textW / 2, y, 10 * typeScale, fonts, false, MUTED);
      drawMixedLine(page, siteLabel, bleed + trimW - margin - widthOfRuns(splitFontRuns(siteLabel, fonts), 7 * typeScale, false), y, 7 * typeScale, fonts, false, MUTED);
    } else {
      // Picture across the top edge to edge, text below.
      const imgH = bleed + trimH * 0.6;
      const art = await preparePicture(doc, picture, fullW, imgH);
      if (art) page.drawImage(art, { x: 0, y: fullH - imgH, width: fullW, height: imgH });
      else page.drawRectangle({ x: 0, y: fullH - imgH, width: fullW, height: imgH, color: rgb(0.93, 0.92, 0.95) });
      const textTop = fullH - imgH - margin * 0.7;
      const textBottom = bleed + margin * 1.1;
      const block = fitLines(body, 19 * typeScale, false, trimW - 2.6 * margin, textTop - textBottom, 1.5);
      const top = textBottom + (textTop - textBottom) / 2 + block.height / 2;
      drawLines(page, block, bleed + trimW / 2, Math.min(textTop, top), false, INK);
      footer(page, pageInput.pageNumber);
    }
  }

  // ---------- 4. Back cover ----------
  {
    const page = newPage(PLUM);
    const centerX = bleed + trimW / 2;
    const contentW = Math.min(trimW - 2 * margin, 430 * typeScale);
    let top = bleed + trimH - margin * 1.3;
    top = drawLines(page, fitLines(input.title, 20 * typeScale, true, contentW, 70 * typeScale, 1.25), centerX, top, true, WHITE) - 14 * typeScale;
    const side = Math.min(trimW * 0.24, trimH * 0.17);
    const portrait = await preparePicture(doc, input.portrait ?? input.cover, side, side);
    if (portrait) {
      page.drawRectangle({ x: centerX - side / 2 - 4, y: top - side - 4, width: side + 8, height: side + 8, color: WHITE });
      page.drawImage(portrait, { x: centerX - side / 2, y: top - side, width: side, height: side });
      top -= side + 22 * typeScale;
    }
    const qrSide = Math.min(trimW * 0.2, trimH * 0.13);
    const qrBlockH = qrSide + 44 * typeScale;
    const qrBottom = bleed + margin * 1.6;
    if (input.blurb?.trim()) {
      const available = top - (qrBottom + qrBlockH + 20 * typeScale);
      if (available > 30 * typeScale) drawLines(page, fitLines(paragraphs(input.blurb), 13 * typeScale, false, contentW, available), centerX, top, false, WHITE);
    }
    const codes: Array<{ url: string; title: string; hint: string }> = [];
    if (input.listenUrl) codes.push({ url: input.listenUrl, title: input.listenHasAudio ? labels.listen : labels.read, hint: labels.listenHint });
    if (input.createUrl) codes.push({ url: input.createUrl, title: labels.create, hint: labels.createHint });
    const slotW = Math.min(contentW / Math.max(1, codes.length), qrSide * 2.2);
    for (let index = 0; index < codes.length; index += 1) {
      const code = codes[index];
      const cx = centerX + (index - (codes.length - 1) / 2) * slotW;
      const qr = await qrImage(doc, code.url);
      if (!qr) continue;
      const pad = 5 * typeScale;
      const qrY = qrBottom + 30 * typeScale;
      page.drawRectangle({ x: cx - qrSide / 2 - pad, y: qrY - pad, width: qrSide + 2 * pad, height: qrSide + 2 * pad, color: WHITE });
      page.drawImage(qr, { x: cx - qrSide / 2, y: qrY, width: qrSide, height: qrSide });
      const caption = fitLines(code.title, 10.5 * typeScale, true, slotW - 8, 14 * typeScale, 1.2);
      drawLines(page, caption, cx, qrY - pad - 4 * typeScale, true, WHITE);
      drawCenteredMixedLine(page, code.hint, cx, qrBottom - 2 * typeScale, 7.5 * typeScale, fonts, false, rgb(0.85, 0.8, 0.95));
    }
    const y = bleed + Math.max(12, margin * 0.45);
    drawCenteredMixedLine(page, `${siteLabel} · ${labels.madeWith}`, centerX, y, 8 * typeScale, fonts, false, rgb(0.85, 0.8, 0.95));
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
