import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { isAllowedPageCount } from './bookStateService';
import { BOOK_FONTS, BookFontChoice, BookFontFace, BookFontId, FALLBACK_BOOK_FONTS, resolveBookFont } from './bookFonts';

// ============================================================
// Children's Book — final PDF assembly. Exactly the purchased book's own
// pageCount (5/10/15/20) A4 pages, page 1 is the cover and counts toward
// that total (never an extra page) — Phase 5.1's exact-page-count
// invariant, generalized for the variable-page-count product model and
// enforced here at the one place the PDF is actually built, not just
// trusted from callers.
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

export interface BookPdfInput {
  title: string;
  dedication: string | null;
  pageCount: number; // the purchased book's own pageCount — 5/10/15/20
  pages: BookPdfPageInput[];
  print?: PrintSettings; // default A4 portrait, no bleed
  fontId?: string | null; // a BOOK_FONTS key; unknown/missing = the default font
}

export class InvalidBookPdfPageCountError extends Error {
  constructor(expected: number, actual: number) {
    super(`Book PDF invariant violated: expected exactly ${expected} pages (page 1 = cover, included in the count), got ${actual}.`);
    this.name = 'InvalidBookPdfPageCountError';
  }
}

export async function buildBookPdf(input: BookPdfInput): Promise<Buffer> {
  if (!isAllowedPageCount(input.pageCount) || input.pages.length !== input.pageCount) {
    throw new InvalidBookPdfPageCountError(input.pageCount, input.pages.length);
  }

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await embedFonts(doc, resolveBookFont(input.fontId));

  const sorted = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const print = input.print ?? DEFAULT_PRINT_SETTINGS;
  const trimW = print.widthMm * MM_TO_PT;
  const trimH = print.heightMm * MM_TO_PT;
  const bleed = print.bleedMm * MM_TO_PT;
  // Type, margins and spacing scale with the page so a small or large print
  // keeps the same proportions as the A4 original.
  // Compared with A4 in the same orientation, so a landscape page is not
  // treated as a tiny portrait one.
  const scale = Math.min(Math.max(trimW, trimH) / A4_HEIGHT, Math.min(trimW, trimH) / A4_WIDTH);
  const typeScale = Math.max(0.6, Math.min(scale, 1.4));
  const margin = Math.max(18, 48 * Math.min(scale, 1.4));
  const landscape = trimW > trimH * 1.15;

  const placeholder = (page: PDFPage, x: number, y: number, w: number, h: number) =>
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.93, 0.93, 0.93) });

  for (let i = 0; i < sorted.length; i++) {
    const pageInput = sorted[i];
    const page = doc.addPage([trimW + 2 * bleed, trimH + 2 * bleed]);
    if (bleed) {
      page.setBleedBox(0, 0, trimW + 2 * bleed, trimH + 2 * bleed);
      page.setTrimBox(bleed, bleed, trimW, trimH);
    }
    const isCover = i === 0;
    // All coordinates below are inside the trim box.
    const ox = bleed;
    const oy = bleed;

    // Image box: top part of a portrait/square page, left part of a wide one.
    const image = landscape
      ? { x: margin, y: margin, w: trimW * 0.56 - margin * 1.5, h: trimH - 2 * margin }
      : { x: margin, y: trimH - margin - trimH * (isCover ? 0.65 : 0.62), w: trimW - 2 * margin, h: trimH * (isCover ? 0.65 : 0.62) };
    const text = landscape
      ? { x: trimW * 0.56 + margin * 0.5, top: trimH - margin - (isCover ? trimH * 0.12 : 0), w: trimW * 0.44 - margin * 1.5, bottom: margin }
      : { x: margin, top: image.y - 16 * typeScale, w: trimW - 2 * margin, bottom: margin };
    const centerX = ox + text.x + text.w / 2;

    if (pageInput.imageBuffer && pageInput.imageMimeType) {
      try {
        const embedded = pageInput.imageMimeType === 'image/jpeg'
          ? await doc.embedJpg(pageInput.imageBuffer)
          : await doc.embedPng(pageInput.imageBuffer);
        const fit = Math.min(image.w / embedded.width, image.h / embedded.height);
        const drawWidth = embedded.width * fit;
        const drawHeight = embedded.height * fit;
        page.drawImage(embedded, {
          x: ox + image.x + (image.w - drawWidth) / 2,
          y: oy + image.y + (image.h - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      } catch {
        // A corrupt/unsupported buffer must not fail the whole PDF — the
        // page still gets its story text, just without an illustration.
        placeholder(page, ox + image.x, oy + image.y, image.w, image.h);
      }
    } else {
      placeholder(page, ox + image.x, oy + image.y, image.w, image.h);
    }

    // Shrinks the type until a block fits the space left (small custom
    // sizes, long edited text), never below a readable minimum.
    const fitBlock = (content: string, size: number, bold: boolean, available: number) => {
      let current = size;
      let lines = wrapText(content, text.w, current, fonts, bold);
      while (current > 7 && lines.length * current * 1.33 > available) {
        current -= 0.5;
        lines = wrapText(content, text.w, current, fonts, bold);
      }
      return { size: current, lines };
    };
    const paragraphs = (content: string) => content.split(/\n+/).map((part) => part.trim()).filter(Boolean).join(' ');
    const drawBlock = (content: string, size: number, bold: boolean, y: number, color = rgb(0.15, 0.1, 0.05)) => {
      const available = y - text.bottom;
      const block = fitBlock(content, size, bold, available);
      for (const line of block.lines) {
        if (y < text.bottom) break;
        drawCenteredMixedLine(page, line, centerX, oy + y, block.size, fonts, bold, color);
        y -= block.size * 1.33;
      }
      return y;
    };

    if (isCover) {
      let y = text.top;
      y = drawBlock(input.title, 26 * typeScale, true, y) - 6 * typeScale;
      if (input.dedication) {
        y = drawBlock(input.dedication, 14 * typeScale, false, y - 6 * typeScale, rgb(0.35, 0.3, 0.25));
      }
      // Page 1's story text opens the tale on the cover page itself (it is
      // one of the purchased pages, so its words must not be dropped).
      if (pageInput.storyText?.trim()) drawBlock(paragraphs(pageInput.storyText), 13 * typeScale, false, y - 14 * typeScale);
    } else {
      const body = paragraphs(pageInput.storyText);
      let top = text.top;
      if (landscape) {
        // Centre the text vertically beside the picture.
        const block = fitBlock(body, 15 * typeScale, false, text.top - text.bottom);
        const height = block.lines.length * block.size * 1.33;
        top = Math.min(text.top, (trimH + height) / 2);
      }
      drawBlock(body, 15 * typeScale, false, top);
      page.drawText(String(pageInput.pageNumber), {
        x: ox + trimW - margin - 10 * typeScale,
        y: oy + margin / 2,
        size: 10 * typeScale,
        font: fonts.latinChain[0].regular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
