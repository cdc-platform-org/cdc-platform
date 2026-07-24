import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'public', 'templates', 'certificate-template.pdf');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// pdf-lib's built-in 14 standard fonts (Helvetica etc.) only support WinAnsi
// encoding — they cannot render Georgian text at all (throws at draw time).
// Student names, course titles, and mentor names on this platform are
// routinely Georgian or mixed Georgian/Latin (e.g. "Vibe Coding -
// ვებ-დეველოპმენტი AI-ით"), so a single WinAnsi font can't cover them. These
// are the actual font FILES (not the @fontsource CSS/webfont build) — one
// Georgian-script subset, one Latin/everything-else — split per glyph run at
// draw time by drawMixedScriptText() below.
const GEORGIAN_FONT_BOLD_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff');
const GEORGIAN_FONT_REGULAR_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff');

export function getVerificationUrl(verificationCode: string): string {
  return `${FRONTEND_URL}/verify/${verificationCode}`;
}

export class CertificateTemplateMissingError extends Error {
  constructor() {
    super(`Certificate template not found at ${TEMPLATE_PATH}.`);
    this.name = 'CertificateTemplateMissingError';
  }
}

export interface CertificateData {
  studentName: string;
  // English transliteration, shown as a smaller second line under the main
  // name when the student has set one under /dashboard/settings.
  studentNameSecondary?: string | null;
  courseTitle: string;
  instructorName: string;
  issueDate: Date;
  verificationCode: string;
}

// CDC-CERT-YYYYMMDD-XXXXXXXX — short enough to print/read, random enough not
// to be guessable, and includes the date for a quick human sanity check.
export function generateVerificationCode(issueDate: Date): string {
  const datePart = issueDate.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `CDC-CERT-${datePart}-${randomPart}`;
}

// ============================================================
// Mixed-script text rendering — splits a string into runs of Georgian-block
// codepoints vs everything else, so each run can be drawn with the font that
// actually has its glyphs. Georgian Unicode blocks: U+10A0–U+10FF (main),
// U+1C90–U+1CBF (Mtavruli), U+2D00–U+2D2F (Supplement, rare).
// ============================================================

const GEORGIAN_CHAR = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;

interface ScriptRun {
  text: string;
  georgian: boolean;
}

// pdf-lib's StandardFonts (Helvetica etc.) only support WinAnsi encoding —
// they throw on anything outside it. Rather than hand-maintaining the full
// WinAnsi table, known "smart" typography (em/en dashes, curly quotes,
// ellipsis — routinely pasted into course titles from elsewhere) is mapped
// to a safe ASCII equivalent first, and anything else outside printable
// ASCII / Latin-1 supplement falls back to '?' — so a single unusual or
// corrupted character can never crash certificate generation outright.
// Only ever applied to non-Georgian runs (see splitScriptRuns below).
function sanitizeLatinForWinAnsi(text: string): string {
  const normalized = text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
  return Array.from(normalized)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) ? ch : '?';
    })
    .join('');
}

function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current = '';
  let currentIsGeorgian: boolean | null = null;
  const flush = (chunk: string, isGeorgian: boolean) => (isGeorgian ? chunk : sanitizeLatinForWinAnsi(chunk));
  for (const ch of text) {
    const isGeorgian = GEORGIAN_CHAR.test(ch);
    if (currentIsGeorgian === null || isGeorgian === currentIsGeorgian) {
      current += ch;
      currentIsGeorgian = isGeorgian;
    } else {
      runs.push({ text: flush(current, currentIsGeorgian), georgian: currentIsGeorgian });
      current = ch;
      currentIsGeorgian = isGeorgian;
    }
  }
  if (current) runs.push({ text: flush(current, currentIsGeorgian ?? false), georgian: currentIsGeorgian ?? false });
  return runs;
}

interface MixedFontPair {
  georgian: PDFFont;
  latin: PDFFont;
}

function widthOfMixedText(runs: ScriptRun[], size: number, fonts: MixedFontPair): number {
  return runs.reduce((sum, run) => sum + (run.georgian ? fonts.georgian : fonts.latin).widthOfTextAtSize(run.text, size), 0);
}

// Shrinks `size` down to `minSize` until the mixed-script text fits maxWidth
// — the same role fitText() played for single-font text before.
function fitMixedText(text: string, maxWidth: number, startSize: number, minSize: number, fonts: MixedFontPair): { size: number; runs: ScriptRun[] } {
  const runs = splitScriptRuns(text);
  let size = startSize;
  while (size > minSize && widthOfMixedText(runs, size, fonts) > maxWidth) {
    size -= 1;
  }
  return { size, runs };
}

function drawMixedScriptText(
  page: import('pdf-lib').PDFPage,
  runs: ScriptRun[],
  opts: { centerX: number; y: number; size: number; color: ReturnType<typeof rgb>; fonts: MixedFontPair }
) {
  const totalWidth = widthOfMixedText(runs, opts.size, opts.fonts);
  let x = opts.centerX - totalWidth / 2;
  for (const run of runs) {
    const font = run.georgian ? opts.fonts.georgian : opts.fonts.latin;
    page.drawText(run.text, { x, y: opts.y, size: opts.size, font, color: opts.color });
    x += font.widthOfTextAtSize(run.text, opts.size);
  }
}

// Greedy word-wrap, mixed-script aware (splits each candidate line into
// Georgian/Latin runs to measure it correctly rather than assuming one font).
function wrapMixedText(text: string, maxWidth: number, size: number, fonts: MixedFontPair): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = widthOfMixedText(splitScriptRuns(candidate), size, fonts);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

// Long course titles get a smaller starting size so they're less likely to
// need wrapping at all; anything that still doesn't fit within maxLines
// keeps shrinking until it does (down to minSize) rather than clipping or
// overlapping the artwork below it.
function fitMixedTextMultiline(
  text: string,
  maxWidth: number,
  opts: { baseSize: number; longTitleThreshold: number; longTitleSize: number; minSize: number; maxLines: number; fonts: MixedFontPair }
): { size: number; lines: string[] } {
  let size = text.length > opts.longTitleThreshold ? opts.longTitleSize : opts.baseSize;
  let lines = wrapMixedText(text, maxWidth, size, opts.fonts);
  while (lines.length > opts.maxLines && size > opts.minSize) {
    size -= 1;
    lines = wrapMixedText(text, maxWidth, size, opts.fonts);
  }
  return { size, lines };
}

// Draws a wrapped, centered text block whose vertical MIDPOINT sits at
// `centerY` — so extra lines grow evenly upward and downward instead of
// pushing everything below it further down the page.
function drawMixedScriptBlock(
  page: import('pdf-lib').PDFPage,
  lines: string[],
  opts: { centerX: number; centerY: number; size: number; lineHeight: number; color: ReturnType<typeof rgb>; fonts: MixedFontPair }
) {
  const blockHeight = (lines.length - 1) * opts.lineHeight;
  const topY = opts.centerY + blockHeight / 2;
  lines.forEach((line, i) => {
    const runs = splitScriptRuns(line);
    drawMixedScriptText(page, runs, {
      centerX: opts.centerX,
      y: topY - i * opts.lineHeight,
      size: opts.size,
      color: opts.color,
      fonts: opts.fonts,
    });
  });
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new CertificateTemplateMissingError();
  }
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);
  const page = doc.getPages()[0];
  const { width, height } = page.getSize();

  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const latinRegular = await doc.embedFont(StandardFonts.Helvetica);
  const georgianBold = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_BOLD_PATH), { subset: true });
  const georgianRegular = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_REGULAR_PATH), { subset: true });
  const boldFonts: MixedFontPair = { georgian: georgianBold, latin: latinBold };
  const regularFonts: MixedFontPair = { georgian: georgianRegular, latin: latinRegular };

  const navy = rgb(0.06, 0.09, 0.16);
  const maxTextWidth = width - 160;

  // Real branded template (public/templates/certificate-template.pdf) —
  // coordinates below are fractions of the page box, matched by eye against
  // its blank reserved regions: name band above the gold divider, course
  // title band below "for successfully completing…", and a footer row with
  // a static baked-in Director signature (left), an Issue Date box, a
  // Certificate ID box, and a blank Instructor slot (right). If the template
  // is ever redesigned at a different aspect ratio, re-check these against a
  // rendered test certificate rather than assuming they still line up.

  // Student name — large, centered, sitting exactly on the "PRESENTED TO"
  // baseline. If the student has set an English transliteration under
  // /dashboard/settings, it's drawn as a smaller second line directly below
  // — the primary baseline position never moves, so it stays exactly where
  // the template art expects it regardless of whether the second line exists.
  const { size: nameSize, runs: nameRuns } = fitMixedText(data.studentName, maxTextWidth, 34, 18, boldFonts);
  const nameBaselineY = height * 0.393;
  drawMixedScriptText(page, nameRuns, { centerX: width / 2, y: nameBaselineY, size: nameSize, color: navy, fonts: boldFonts });

  if (data.studentNameSecondary) {
    const secondarySize = Math.max(12, Math.round(nameSize * 0.45));
    const { size: fittedSecondarySize, runs: secondaryRuns } = fitMixedText(
      data.studentNameSecondary,
      maxTextWidth,
      secondarySize,
      10,
      regularFonts
    );
    drawMixedScriptText(page, secondaryRuns, {
      centerX: width / 2,
      y: nameBaselineY - nameSize * 0.85,
      size: fittedSecondarySize,
      color: navy,
      fonts: regularFonts,
    });
  }

  // Course title — the centerpiece of the certificate. Starts large (30pt),
  // drops to a smaller starting size for long titles (>35 chars), and wraps
  // to up to 2 centered lines rather than clipping or overlapping — the
  // block's vertical midpoint is pinned to the template's title band so
  // extra lines grow evenly above/below it instead of drifting off-band.
  const { size: courseSize, lines: courseLines } = fitMixedTextMultiline(data.courseTitle, maxTextWidth, {
    baseSize: 30,
    longTitleThreshold: 35,
    longTitleSize: 22,
    minSize: 14,
    maxLines: 2,
    fonts: boldFonts,
  });
  drawMixedScriptBlock(page, courseLines, {
    centerX: width / 2,
    centerY: height * 0.24,
    size: courseSize,
    lineHeight: courseSize * 1.25,
    color: navy,
    fonts: boldFonts,
  });

  // Issue date — inside the calendar-icon box in the footer row (pure digits/dashes, plain Latin font is enough).
  const dateText = data.issueDate.toISOString().slice(0, 10);
  const dateWidth = latinRegular.widthOfTextAtSize(dateText, 11);
  page.drawText(dateText, {
    x: width * 0.383 - dateWidth / 2,
    y: height * 0.105,
    size: 11,
    font: latinRegular,
    color: navy,
  });

  // Certificate ID (verification code) — inside the ID box in the footer row
  // (always plain Latin/digits — see generateVerificationCode above).
  let codeSize = 10;
  while (codeSize > 6 && latinRegular.widthOfTextAtSize(data.verificationCode, codeSize) > width * 0.11) {
    codeSize -= 1;
  }
  const codeWidth = latinRegular.widthOfTextAtSize(data.verificationCode, codeSize);
  page.drawText(data.verificationCode, {
    x: width * 0.524 - codeWidth / 2,
    y: height * 0.105,
    size: codeSize,
    font: latinRegular,
    color: navy,
  });

  // Instructor name — the template's Director signature is baked into the
  // artwork; this is the separate, blank "ლექტორი / Instructor" slot, filled
  // in per-course from Course.mentorName.
  const instructorRuns = splitScriptRuns(data.instructorName);
  drawMixedScriptText(page, instructorRuns, { centerX: width * 0.865, y: height * 0.135, size: 12, color: navy, fonts: regularFonts });

  // QR code, bottom-right corner — encodes the public /verify/[code] page so
  // the certificate can be authenticity-checked by scanning, without typing
  // the code in by hand.
  const verificationUrl = getVerificationUrl(data.verificationCode);
  const qrPngDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 200 });
  const qrPngBytes = Buffer.from(qrPngDataUrl.split(',')[1], 'base64');
  const qrImage = await doc.embedPng(qrPngBytes);
  const qrSize = width * 0.032;
  page.drawImage(qrImage, {
    x: width - width * 0.012 - qrSize,
    y: height * 0.012,
    width: qrSize,
    height: qrSize,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
