import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { isAllowedPageCount } from './bookStateService';

// ============================================================
// Children's Book — final PDF assembly. Exactly the purchased book's own
// pageCount (5/10/15/20) A4 pages, page 1 is the cover and counts toward
// that total (never an extra page) — Phase 5.1's exact-page-count
// invariant, generalized for the variable-page-count product model and
// enforced here at the one place the PDF is actually built, not just
// trusted from callers.
//
// Mixed Georgian/Latin text support follows certificateService.ts's own
// precedent (separate Georgian-script font file + Latin StandardFont,
// split per run) — a small, independent implementation here rather than
// importing certificateService's private helpers, since this file's layout
// needs (a simple wrapped paragraph block, not an auto-scaling certificate
// title) are much simpler.
// ============================================================

const GEORGIAN_FONT_REGULAR_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff');
const GEORGIAN_FONT_BOLD_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;

const GEORGIAN_RANGE = /[Ⴀ-ჿ]/;

interface Run {
  text: string;
  georgian: boolean;
}

function splitScriptRuns(text: string): Run[] {
  const runs: Run[] = [];
  let current = '';
  let currentIsGeorgian: boolean | null = null;
  for (const ch of text) {
    const isGeorgian = GEORGIAN_RANGE.test(ch);
    if (currentIsGeorgian === null || isGeorgian === currentIsGeorgian) {
      current += ch;
      currentIsGeorgian = isGeorgian;
    } else {
      runs.push({ text: current, georgian: currentIsGeorgian });
      current = ch;
      currentIsGeorgian = isGeorgian;
    }
  }
  if (current) runs.push({ text: current, georgian: currentIsGeorgian ?? false });
  return runs;
}

interface Fonts {
  latin: PDFFont;
  latinBold: PDFFont;
  georgian: PDFFont;
  georgianBold: PDFFont;
}

function fontFor(fonts: Fonts, georgian: boolean, bold: boolean): PDFFont {
  if (georgian) return bold ? fonts.georgianBold : fonts.georgian;
  return bold ? fonts.latinBold : fonts.latin;
}

function widthOfRuns(runs: Run[], size: number, fonts: Fonts, bold: boolean): number {
  return runs.reduce((sum, run) => sum + fontFor(fonts, run.georgian, bold).widthOfTextAtSize(run.text, size), 0);
}

// Greedy word-wrap across mixed-script runs, wrapping on spaces only
// (sufficient for the short story-text paragraphs this product writes).
function wrapText(text: string, maxWidth: number, size: number, fonts: Fonts, bold: boolean): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = widthOfRuns(splitScriptRuns(candidate), size, fonts, bold);
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
  for (const run of splitScriptRuns(line)) {
    const font = fontFor(fonts, run.georgian, bold);
    page.drawText(run.text, { x: cursorX, y, size, font, color });
    cursorX += font.widthOfTextAtSize(run.text, size);
  }
}

function drawCenteredMixedLine(page: PDFPage, line: string, centerX: number, y: number, size: number, fonts: Fonts, bold: boolean, color = rgb(0.15, 0.1, 0.05)): void {
  const width = widthOfRuns(splitScriptRuns(line), size, fonts, bold);
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
  const fonts: Fonts = {
    latin: await doc.embedFont(StandardFonts.Helvetica),
    latinBold: await doc.embedFont(StandardFonts.HelveticaBold),
    georgian: await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_REGULAR_PATH), { subset: true }),
    georgianBold: await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_BOLD_PATH), { subset: true }),
  };

  const sorted = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (let i = 0; i < sorted.length; i++) {
    const pageInput = sorted[i];
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    const isCover = i === 0;

    const imageAreaHeight = isCover ? A4_HEIGHT * 0.65 : A4_HEIGHT * 0.62;
    const imageAreaY = A4_HEIGHT - MARGIN - imageAreaHeight;

    if (pageInput.imageBuffer && pageInput.imageMimeType) {
      try {
        const embedded = pageInput.imageMimeType === 'image/jpeg'
          ? await doc.embedJpg(pageInput.imageBuffer)
          : await doc.embedPng(pageInput.imageBuffer);
        const maxWidth = A4_WIDTH - 2 * MARGIN;
        const scale = Math.min(maxWidth / embedded.width, imageAreaHeight / embedded.height);
        const drawWidth = embedded.width * scale;
        const drawHeight = embedded.height * scale;
        page.drawImage(embedded, {
          x: (A4_WIDTH - drawWidth) / 2,
          y: imageAreaY + (imageAreaHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      } catch {
        // A corrupt/unsupported buffer must not fail the whole PDF — the
        // page still gets its story text, just without an illustration.
        page.drawRectangle({ x: MARGIN, y: imageAreaY, width: A4_WIDTH - 2 * MARGIN, height: imageAreaHeight, color: rgb(0.93, 0.93, 0.93) });
      }
    } else {
      page.drawRectangle({ x: MARGIN, y: imageAreaY, width: A4_WIDTH - 2 * MARGIN, height: imageAreaHeight, color: rgb(0.93, 0.93, 0.93) });
    }

    const textAreaTop = imageAreaY - 16;
    const textMaxWidth = A4_WIDTH - 2 * MARGIN;

    if (isCover) {
      const titleLines = wrapText(input.title, textMaxWidth, 26, fonts, true);
      let y = textAreaTop;
      for (const line of titleLines) {
        drawCenteredMixedLine(page, line, A4_WIDTH / 2, y, 26, fonts, true);
        y -= 32;
      }
      if (input.dedication) {
        y -= 12;
        const dedicationLines = wrapText(input.dedication, textMaxWidth, 14, fonts, false);
        for (const line of dedicationLines) {
          drawCenteredMixedLine(page, line, A4_WIDTH / 2, y, 14, fonts, false, rgb(0.35, 0.3, 0.25));
          y -= 18;
        }
      }
    } else {
      const lines = wrapText(pageInput.storyText, textMaxWidth, 15, fonts, false);
      let y = textAreaTop;
      for (const line of lines) {
        drawCenteredMixedLine(page, line, A4_WIDTH / 2, y, 15, fonts, false);
        y -= 20;
      }
      page.drawText(String(pageInput.pageNumber), {
        x: A4_WIDTH - MARGIN - 10,
        y: MARGIN / 2,
        size: 10,
        font: fonts.latin,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
