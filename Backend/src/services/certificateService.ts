import { PDFDocument, StandardFonts, rgb, PDFFont, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CERTIFICATE_DIRECTOR_NAME } from '../utils/env';

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'public', 'templates', 'certificate-template.pdf');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

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
  // English transliteration of the student's legal name, set under
  // /dashboard/settings. Drawn on the same line as the Georgian name as
  // "ია თავდიშვილი / Ia Tavdishvili" — see displayName in
  // generateCertificatePdf. Never guessed when unset.
  studentNameSecondary?: string | null;
  courseTitle: string;
  // Optional English translation of courseTitle (Course.titleEn) — never
  // guessed. When set, the certificate prints "courseTitle / courseTitleEn"
  // on the same auto-scaling title block; otherwise just courseTitle alone.
  courseTitleEn?: string | null;
  instructorName: string;
  // Signatory for the left-hand signature rule. Falls back to
  // CERTIFICATE_DIRECTOR_NAME, and when that is unset too the rule is left
  // blank (with its role label still printed) rather than filled with a
  // fabricated name.
  directorName?: string | null;
  issueDate: Date;
  verificationCode: string;
}

// Students can (and often do) type their English legal name in whatever
// case they like under /dashboard/settings — capitalize each word for the
// certificate specifically, without touching the stored value or any other
// place that name is displayed.
//
// Splits on hyphens as well as spaces: double-barrelled surnames are common
// here, and splitting on spaces alone printed "javakhishvili-maisuradze" as
// "Javakhishvili-maisuradze". Each part keeps its own capital, and the
// separators are preserved exactly as typed (so spacing/hyphenation is not
// normalised behind the student's back).
function toTitleCase(text: string): string {
  return text.replace(/[^\s-]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
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

function countChars(runs: ScriptRun[]): number {
  return runs.reduce((n, run) => n + Array.from(run.text).length, 0);
}

// `letterSpacing` is extra tracking in points inserted after every glyph but
// the last — pdf-lib's drawText has no tracking option, so the drawing side
// below emits one glyph at a time when it's non-zero. Used for the small
// upper-case label lines ("PRESENTED TO", role captions), where tracking is
// what makes them read as captions rather than body text. Georgian is not a
// connected script, so per-glyph drawing is safe for both fonts.
function widthOfMixedText(runs: ScriptRun[], size: number, fonts: MixedFontPair, letterSpacing = 0): number {
  const base = runs.reduce((sum, run) => sum + (run.georgian ? fonts.georgian : fonts.latin).widthOfTextAtSize(run.text, size), 0);
  return letterSpacing ? base + letterSpacing * Math.max(0, countChars(runs) - 1) : base;
}

// Shrinks `size` down to `minSize` until the mixed-script text fits maxWidth
// — the same role fitText() played for single-font text before.
function fitMixedText(
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fonts: MixedFontPair,
  letterSpacing = 0
): { size: number; runs: ScriptRun[] } {
  const runs = splitScriptRuns(text);
  let size = startSize;
  while (size > minSize && widthOfMixedText(runs, size, fonts, letterSpacing) > maxWidth) {
    size -= 1;
  }
  return { size, runs };
}

function drawMixedScriptText(
  page: import('pdf-lib').PDFPage,
  runs: ScriptRun[],
  opts: { centerX: number; y: number; size: number; color: ReturnType<typeof rgb>; fonts: MixedFontPair; letterSpacing?: number }
) {
  const letterSpacing = opts.letterSpacing ?? 0;
  const totalWidth = widthOfMixedText(runs, opts.size, opts.fonts, letterSpacing);
  let x = opts.centerX - totalWidth / 2;
  for (const run of runs) {
    const font = run.georgian ? opts.fonts.georgian : opts.fonts.latin;
    if (!letterSpacing) {
      page.drawText(run.text, { x, y: opts.y, size: opts.size, font, color: opts.color });
      x += font.widthOfTextAtSize(run.text, opts.size);
      continue;
    }
    for (const ch of Array.from(run.text)) {
      page.drawText(ch, { x, y: opts.y, size: opts.size, font, color: opts.color });
      x += font.widthOfTextAtSize(ch, opts.size) + letterSpacing;
    }
  }
}

// Convenience wrapper for the one-off centered lines (heading, captions, the
// completion sentence) — fits the string to `maxWidth` and draws it in one go.
function drawFittedLine(
  page: import('pdf-lib').PDFPage,
  text: string,
  opts: {
    centerX: number;
    y: number;
    maxWidth: number;
    startSize: number;
    minSize: number;
    color: ReturnType<typeof rgb>;
    fonts: MixedFontPair;
    letterSpacing?: number;
  }
) {
  const { size, runs } = fitMixedText(text, opts.maxWidth, opts.startSize, opts.minSize, opts.fonts, opts.letterSpacing);
  drawMixedScriptText(page, runs, {
    centerX: opts.centerX,
    y: opts.y,
    size,
    color: opts.color,
    fonts: opts.fonts,
    letterSpacing: opts.letterSpacing,
  });
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

// ============================================================
// Template geometry
//
// public/templates/certificate-template.pdf has a MediaBox of exactly
// 1491x1055pt and is built from three layers:
//   1. a flattened 1491x1055 artwork image (frame, CDC logo, laurel seal, and
//      all the gold rules / the navy QR box referenced below) — since the
//      MediaBox matches its pixel size, one artwork pixel is one PDF point;
//   2. the Director's scanned signature, a separate masked image sitting above
//      the left signature rule;
//   3. a TEXT layer holding the heading, the two body sentences and the four
//      footer captions.
//
// Layer 3 is stripped at load time (see stripTextLayer) and re-drawn from
// LABELS below instead of being drawn around. Three reasons it can't just be
// kept: it misspells "professional" as "professioal" in the English body line;
// its footer captions sit on mismatched baselines (Director at y=54 but
// Instructor at y=75.4), so the two signature columns can never line up; and
// it hard-codes one student's name, which every certificate would then print.
// Its fonts are subset CFF/TrueType with no usable ToUnicode, so editing the
// strings in place is not realistically maintainable — owning the text in code
// is. Layers 1 and 2 are untouched, so the design is unchanged.
//
// Landmarks are stored as fractions of the page box so a re-export at another
// DPI still lines up. Artwork pixel rows are noted as `px` for
// re-verification (image y runs from the TOP, pdf y from the BOTTOM, so
// pdfY = 1055 - imgY):
//
//   pdfY 576  px y479  a pair of short gold rules (x 359..489 and 1017..1147)
//                      flanking the heading slot — the heading goes in the
//                      489..1017 gap between them.
//   pdfY 394  px y661  full-width gold divider with a centre diamond
//                      (x 270..1220), separating the "presented to / student
//                      name" band above from the "completed / course" band below.
//   pdfY 62..163       footer row, split into four zones by gold vertical
//                      separators at x 427, 706 and 1094:
//                        zone A  x    0..427   left signature rule  (x   62..387, pdfY 113)
//                                              + Director signature image (pdfY 106..189)
//                        zone B  x  427..706   calendar icon        (x  547..588, pdfY 130..173)
//                        zone C  x  706..1094  navy QR frame        (x  738..862, pdfY 52..181)
//                                              + verification-code slot (x 862..1094)
//                        zone D  x 1094..1491  right signature rule (x 1125..1424, pdfY 113)
//
// The signature rules are part of the artwork, so nothing here draws its own
// underline (an earlier revision did, double-ruling the instructor slot).
// ============================================================
// Exported so scripts/verifyCertificateLayout.ts can assert these landmarks
// against the artwork measured off a rasterised render, instead of against the
// comment above that describes them.
export const G = {
  // The artwork's two short gold rules sit at this baseline (flanking an
  // empty gap, x 489..1017) purely as a decorative divider now — the
  // bilingual heading below got too long to sit flanked between them
  // without crowding/touching their ends, so it was moved to its own row.
  headingRuleY: 565 / 1055,
  // Bilingual heading — clear of the rules above (headingRuleY) and the
  // "presented to" line below (presentedToY), centered independently of
  // the rules' narrow x 489..1017 gap since it no longer sits inside it.
  headingY: 548 / 1055,
  // "presented to" line and the student name, above the gold divider.
  presentedToY: 521 / 1055,
  nameY: 455 / 1055,
  // "completed the course" line and the course title, below the divider.
  completedY: 345.6 / 1055,
  courseCenterY: 285 / 1055,
  // Closing statement — one bilingual line, centered between the template's
  // former two-line Georgian/English slots (was 227 and 205; every other
  // certificate label is a single "ka / en" line, so this one now matches).
  closingY: 216 / 1055,
  // Footer: every zone puts its value on one shared baseline and its caption
  // on another, which is what makes the four columns read as one balanced row.
  footerValueY: 85.5 / 1055,
  footerCaptionY: 58 / 1055,
  // Instructor "signature" line: unlike Director (which has an actual scanned
  // signature image sitting above its rule, pdfY 106..189), Instructor has no
  // scan — the printed name itself stands in for a signature, so it's drawn
  // ABOVE the signature rule (pdfY 113) like ink on the line, with only the
  // "Instructor" role caption below it at the shared footerCaptionY.
  instructorSignatureY: 140 / 1055,
  signatureLeftX: 224.5 / 1491,
  dateCenterX: 567.5 / 1491,
  codeCenterX: 978 / 1491,
  signatureRightX: 1274.5 / 1491,
  // Navy QR frame — the QR is centered inside these bounds, never at the page corner.
  qrFrameLeft: 738 / 1491,
  qrFrameRight: 862 / 1491,
  qrFrameBottom: 52 / 1055,
  qrFrameTop: 181 / 1055,
  // Per-slot text widths, each the usable width of the artwork region it sits in.
  courseMaxWidth: 950 / 1491,
  bodyMaxWidth: 1000 / 1491,
  nameMaxWidth: 1150 / 1491,
  signatureMaxWidth: 320 / 1491,
  dateMaxWidth: 250 / 1491,
  codeMaxWidth: 215 / 1491,
};

// Every fixed string on the certificate. The Georgian is the wording the
// template's own (stripped) text layer used; the English is its counterpart on
// the same line, which is where the template's "professioal" typo lived.
const LABELS = {
  heading: 'კურსის დასრულების სერტიფიკატი / CERTIFICATE OF COMPLETION',
  presentedTo: 'ეს სერტიფიკატი გადაეცემა / This certificate is presented to',
  completed: 'წარმატებით დაასრულა კურსი / for successfully completing the course',
  closing: 'სერტიფიკატი ადასტურებს მიღებულ ცოდნას და პროფესიულ განვითარებას / This certificate confirms the acquired knowledge and professional development',
  director: 'დირექტორი / Director',
  issueDate: 'გაცემის თარიღი / Issue Date',
  certificateId: 'სერტიფიკატის ID / Certificate ID',
  instructor: 'ლექტორი / Instructor',
  scanToVerify: 'დაასკანერე შესამოწმებლად / Scan to verify',
};

// Drops every text-showing block from the page's content stream, keeping all
// image and vector operators (so the artwork and the Director's signature
// survive untouched) — see the layer notes above for why the template's own
// text is not reused. A template that ships without a text layer makes this a
// no-op, so this stays safe if the artwork is ever re-exported clean.
function stripTextLayer(doc: PDFDocument, page: import('pdf-lib').PDFPage): void {
  const decodeStream = (obj: unknown): string | null =>
    obj instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1') : null;

  const contents = doc.context.lookup(page.node.get(PDFName.of('Contents')));
  const parts: string[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const part = decodeStream(doc.context.lookup(contents.get(i)));
      if (part === null) return; // unexpected shape — leave the page as-is
      parts.push(part);
    }
  } else {
    const part = decodeStream(contents);
    if (part === null) return;
    parts.push(part);
  }

  const stripped = parts.join('\n').replace(/\bBT\b[\s\S]*?\bET\b/g, '');
  const ref = doc.context.register(doc.context.flateStream(stripped));
  page.node.set(PDFName.of('Contents'), ref);
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new CertificateTemplateMissingError();
  }
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);
  const page = doc.getPages()[0];
  stripTextLayer(doc, page);
  const { width, height } = page.getSize();

  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const latinRegular = await doc.embedFont(StandardFonts.Helvetica);
  const georgianBold = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_BOLD_PATH), { subset: true });
  const georgianRegular = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_REGULAR_PATH), { subset: true });
  const boldFonts: MixedFontPair = { georgian: georgianBold, latin: latinBold };
  const regularFonts: MixedFontPair = { georgian: georgianRegular, latin: latinRegular };

  const navy = rgb(0.06, 0.09, 0.16);
  // Muted slate for the caption/body lines, so they sit clearly behind the
  // student name and course title in the page's visual hierarchy instead of
  // competing with them for attention.
  const slate = rgb(0.42, 0.45, 0.52);
  const centerX = width / 2;

  // Bilingual heading — its own row below the artwork's gold rules (which
  // stay a plain decorative divider above it), full body width so it never
  // has to crowd/touch the rules' ends.
  drawFittedLine(page, LABELS.heading, {
    centerX,
    y: height * G.headingY,
    maxWidth: width * G.bodyMaxWidth,
    startSize: 15,
    minSize: 10,
    color: navy,
    fonts: boldFonts,
  });

  // "This certificate is presented to" — the lead-in above the student name.
  drawFittedLine(page, LABELS.presentedTo, {
    centerX,
    y: height * G.presentedToY,
    maxWidth: width * G.bodyMaxWidth,
    startSize: 16,
    minSize: 10,
    color: slate,
    fonts: regularFonts,
  });

  // Student name — the largest text in the upper band, between the lead-in
  // above and the gold divider below. When the student has set an English
  // transliteration under /dashboard/settings, both names are drawn together
  // on this SAME line as "ია თავდიშვილი / Ia Tavdishvili" (a single
  // fitMixedText run) rather than a stacked second line, which previously
  // collided with the divider. Falls back to the Georgian name alone when no
  // transliteration is set (never guessed/fabricated).
  const displayName = data.studentNameSecondary
    ? `${data.studentName} / ${toTitleCase(data.studentNameSecondary)}`
    : data.studentName;
  drawFittedLine(page, displayName, {
    centerX,
    y: height * G.nameY,
    maxWidth: width * G.nameMaxWidth,
    startSize: 44,
    minSize: 18,
    color: navy,
    fonts: boldFonts,
  });

  // "for successfully completing the course" — the lead-in above the title.
  drawFittedLine(page, LABELS.completed, {
    centerX,
    y: height * G.completedY,
    maxWidth: width * G.bodyMaxWidth,
    startSize: 16,
    minSize: 10,
    color: slate,
    fonts: regularFonts,
  });

  // Course title — the centerpiece of the certificate and, after the student
  // name, the most prominent text on the page. Starts at 44pt bold, steps down
  // to 34pt for long titles (>32 chars), and wraps to up to 2 centered lines
  // rather than clipping; the block's vertical midpoint is pinned inside the
  // band the divider opens, so a second line grows evenly above and below
  // instead of pushing into the closing lines beneath it.
  const displayCourseTitle = data.courseTitleEn ? `${data.courseTitle} / ${data.courseTitleEn}` : data.courseTitle;
  const { size: courseSize, lines: courseLines } = fitMixedTextMultiline(displayCourseTitle, width * G.courseMaxWidth, {
    baseSize: 44,
    longTitleThreshold: 32,
    longTitleSize: 34,
    minSize: 16,
    maxLines: 2,
    fonts: boldFonts,
  });
  drawMixedScriptBlock(page, courseLines, {
    centerX,
    centerY: height * G.courseCenterY,
    size: courseSize,
    lineHeight: courseSize * 1.2,
    color: navy,
    fonts: boldFonts,
  });

  // Closing statement — one bilingual line. "professional" is spelled out in
  // full here — the template's own (stripped) text layer had it as "professioal".
  drawFittedLine(page, LABELS.closing, {
    centerX,
    y: height * G.closingY,
    maxWidth: width * G.bodyMaxWidth,
    startSize: 15,
    minSize: 9,
    color: slate,
    fonts: regularFonts,
  });

  // Footer row — four zones, every value on one shared baseline and every
  // caption on another, each centered on its own artwork landmark (the two
  // signature rules, the calendar icon, the code slot beside the QR frame).
  // That shared rhythm is what makes the Director and Instructor columns
  // symmetric; the template's own captions sat on mismatched baselines.
  //
  // The Director name is blank when neither the caller nor
  // CERTIFICATE_DIRECTOR_NAME supplies one — the caption still prints, rather
  // than inventing a name to sit above the scanned signature.
  const footerSlots: Array<{ centerX: number; value: string; caption: string; maxWidth: number; bold: boolean; valueY?: number }> = [
    {
      centerX: width * G.signatureLeftX,
      value: (data.directorName || CERTIFICATE_DIRECTOR_NAME || '').trim(),
      caption: LABELS.director,
      maxWidth: width * G.signatureMaxWidth,
      bold: true,
    },
    {
      centerX: width * G.dateCenterX,
      value: data.issueDate.toISOString().slice(0, 10),
      caption: LABELS.issueDate,
      maxWidth: width * G.dateMaxWidth,
      bold: false,
    },
    {
      centerX: width * G.codeCenterX,
      value: data.verificationCode,
      caption: LABELS.certificateId,
      maxWidth: width * G.codeMaxWidth,
      bold: false,
    },
    {
      centerX: width * G.signatureRightX,
      value: data.instructorName.trim(),
      caption: LABELS.instructor,
      maxWidth: width * G.signatureMaxWidth,
      bold: true,
      // Above the rule, standing in for a signature — see G.instructorSignatureY.
      valueY: height * G.instructorSignatureY,
    },
  ];
  for (const slot of footerSlots) {
    if (slot.value) {
      drawFittedLine(page, slot.value, {
        centerX: slot.centerX,
        y: slot.valueY ?? height * G.footerValueY,
        maxWidth: slot.maxWidth,
        startSize: 15,
        minSize: 8,
        color: navy,
        fonts: slot.bold ? boldFonts : regularFonts,
      });
    }
    drawFittedLine(page, slot.caption, {
      centerX: slot.centerX,
      y: height * G.footerCaptionY,
      maxWidth: slot.maxWidth,
      startSize: 13,
      minSize: 8,
      color: slate,
      fonts: regularFonts,
    });
  }

  // QR code — encodes the public /verify/[code] page so a certificate can be
  // authenticity-checked by scanning instead of typing the code in by hand.
  // Centered inside the template's navy QR frame and inset from it on all
  // four sides, so it is fully bounded by the frame rather than overlapping
  // its border (an earlier revision pinned it to the bottom-right page
  // corner, well outside the frame). Rendered at 512px and scaled down so it
  // stays crisp at print resolution; QRCode's own `margin: 1` keeps the
  // scanner quiet zone, which lands on the frame's white interior.
  //
  // A "Scan to verify" caption sits below the QR, on the SAME baseline as
  // the other three footer captions (G.footerCaptionY) — not a one-off
  // offset — so the whole footer reads as one aligned caption row instead
  // of a slightly-misaligned fifth line. The QR itself is sized/centered in
  // the region of the frame ABOVE that baseline (plus clearance for the
  // caption's own glyph height), so the two never overlap even though the
  // frame is only 124x129pt.
  const verificationUrl = getVerificationUrl(data.verificationCode);
  const qrPngDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 512 });
  const qrPngBytes = Buffer.from(qrPngDataUrl.split(',')[1], 'base64');
  const qrImage = await doc.embedPng(qrPngBytes);
  const frameLeft = width * G.qrFrameLeft;
  const frameRight = width * G.qrFrameRight;
  const frameBottom = height * G.qrFrameBottom;
  const frameTop = height * G.qrFrameTop;
  const frameInset = 8;
  const captionY = height * G.footerCaptionY;
  const qrRegionBottom = captionY + 10;
  const qrSize = Math.min(frameRight - frameLeft, frameTop - qrRegionBottom) - frameInset * 2;
  page.drawImage(qrImage, {
    x: (frameLeft + frameRight) / 2 - qrSize / 2,
    y: (qrRegionBottom + frameTop) / 2 - qrSize / 2,
    width: qrSize,
    height: qrSize,
  });
  drawFittedLine(page, LABELS.scanToVerify, {
    centerX: (frameLeft + frameRight) / 2,
    y: captionY,
    maxWidth: frameRight - frameLeft,
    startSize: 8,
    minSize: 4,
    color: slate,
    fonts: regularFonts,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
