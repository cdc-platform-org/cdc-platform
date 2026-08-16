import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';

// Same Georgian-script font-embedding approach as certificateService.ts (see
// that file's comment for why pdf-lib's built-in StandardFonts can't render
// Georgian at all) — duplicated rather than shared since the two generators
// draw very differently (a fixed artwork template with centered text vs. a
// plain left-aligned invoice table built from scratch).
const GEORGIAN_FONT_BOLD_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff');
const GEORGIAN_FONT_REGULAR_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff');

const GEORGIAN_CHAR = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;

interface ScriptRun {
  text: string;
  georgian: boolean;
}

function sanitizeLatinForWinAnsi(text: string): string {
  const normalized = text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');
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

// Left-aligned mixed-script line (invoices are a table, not centered
// artwork text like the certificate) — draws at a fixed x, returns nothing,
// truncates with an ellipsis rather than wrapping/shrinking since every
// field here sits in its own table row with a known column width.
function drawText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; color: ReturnType<typeof rgb>; fonts: MixedFontPair; maxWidth?: number }
) {
  let runs = splitScriptRuns(text);
  if (opts.maxWidth) {
    const widthOf = (rs: ScriptRun[]) => rs.reduce((sum, r) => sum + (r.georgian ? opts.fonts.georgian : opts.fonts.latin).widthOfTextAtSize(r.text, opts.size), 0);
    while (widthOf(runs) > opts.maxWidth && runs.some((r) => r.text.length > 1)) {
      const last = runs[runs.length - 1];
      if (last.text.length <= 1) break;
      last.text = last.text.slice(0, -1);
      runs = [...runs.slice(0, -1), { ...last, text: last.text + '…' }];
    }
  }
  let x = opts.x;
  for (const run of runs) {
    const runFont = run.georgian ? opts.fonts.georgian : opts.fonts.latin;
    page.drawText(run.text, { x, y: opts.y, size: opts.size, font: runFont, color: opts.color });
    x += runFont.widthOfTextAtSize(run.text, opts.size);
  }
}

const MERCHANT = {
  orgNameKa: 'ა(ა)იპ ციფრული პროფესიების ცენტრი',
  orgNameEn: 'Digital Careers Center (CDC Georgia)',
  identificationCode: '438737743',
  email: 'contact@cdc.org.ge',
  phone: '+995 551 14 14 11',
  addressKa: 'საქართველო, ქალაქი სამტრედია, თამარ მეფის ქ., N 8, ბინა N2',
};

export interface InvoiceLineItem {
  description: string;
  amount: number; // minor units (tetri)
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  buyerName: string;
  buyerEmail: string;
  // Company/tax identification code, if the buyer is a Business account —
  // omitted (not printed) for an individual buyer with none set.
  buyerTaxId?: string | null;
  lineItems: InvoiceLineItem[];
  // Minor units (tetri) — matches this codebase's Int-money convention
  // (Course.originalPrice, BogPayment.amount, etc.), never Float.
  totalAmount: number;
  // Only set when this transaction actually has a platform/creator split
  // (Digital Store product sales, escrow gig releases) — course and
  // mentorship purchases have no such split today, so these stay null and
  // the PDF simply omits the fee-breakdown block rather than printing a
  // fabricated 0/100 split.
  platformFee?: number | null;
  netAmount?: number | null;
  currency: string;
  status: 'PAID' | 'REFUNDED';
}

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency === 'GEL' ? '₾' : currency}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const latinRegular = await doc.embedFont(StandardFonts.Helvetica);
  const georgianBold = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_BOLD_PATH), { subset: true });
  const georgianRegular = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_REGULAR_PATH), { subset: true });
  const boldFonts: MixedFontPair = { georgian: georgianBold, latin: latinBold };
  const regularFonts: MixedFontPair = { georgian: georgianRegular, latin: latinRegular };

  const navy = rgb(0.06, 0.09, 0.16);
  const slate = rgb(0.42, 0.45, 0.52);
  const emerald = rgb(0.02, 0.45, 0.34);
  const marginX = 50;
  let y = height - 60;

  // Header — invoice number/date on the right, CDC entity block on the left.
  drawText(page, 'INVOICE / ინვოისი', { x: marginX, y, size: 22, color: navy, fonts: boldFonts });
  drawText(page, data.invoiceNumber, { x: width - marginX - 160, y, size: 14, color: navy, fonts: boldFonts, maxWidth: 160 });
  y -= 20;
  drawText(page, data.issueDate.toISOString().slice(0, 10), { x: width - marginX - 160, y, size: 10, color: slate, fonts: regularFonts, maxWidth: 160 });
  y -= 40;

  // Seller block.
  drawText(page, MERCHANT.orgNameKa, { x: marginX, y, size: 11, color: navy, fonts: boldFonts, maxWidth: 320 });
  y -= 14;
  drawText(page, MERCHANT.orgNameEn, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 320 });
  y -= 13;
  drawText(page, `ID / ს/კ: ${MERCHANT.identificationCode}`, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 320 });
  y -= 13;
  drawText(page, MERCHANT.addressKa, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 320 });
  y -= 13;
  drawText(page, `${MERCHANT.email} · ${MERCHANT.phone}`, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 320 });
  y -= 35;

  // Buyer block.
  drawText(page, 'Bill To / მყიდველი', { x: marginX, y, size: 9, color: slate, fonts: boldFonts });
  y -= 15;
  drawText(page, data.buyerName, { x: marginX, y, size: 12, color: navy, fonts: boldFonts, maxWidth: 400 });
  y -= 15;
  drawText(page, data.buyerEmail, { x: marginX, y, size: 10, color: slate, fonts: regularFonts, maxWidth: 400 });
  if (data.buyerTaxId) {
    y -= 13;
    drawText(page, `ID / საიდენტიფიკაციო კოდი: ${data.buyerTaxId}`, { x: marginX, y, size: 10, color: slate, fonts: regularFonts, maxWidth: 400 });
  }
  y -= 40;

  // Line items table.
  const col2 = width - marginX - 100;
  page.drawLine({ start: { x: marginX, y: y + 10 }, end: { x: width - marginX, y: y + 10 }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  drawText(page, 'Description / აღწერა', { x: marginX, y, size: 9, color: slate, fonts: boldFonts });
  drawText(page, 'Amount / თანხა', { x: col2, y, size: 9, color: slate, fonts: boldFonts });
  y -= 8;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  y -= 20;

  for (const item of data.lineItems) {
    drawText(page, item.description, { x: marginX, y, size: 10, color: navy, fonts: regularFonts, maxWidth: col2 - marginX - 20 });
    drawText(page, formatMoney(item.amount, data.currency), { x: col2, y, size: 10, color: navy, fonts: regularFonts, maxWidth: 100 });
    y -= 20;
  }
  y -= 10;
  page.drawLine({ start: { x: marginX, y: y + 10 }, end: { x: width - marginX, y: y + 10 }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  y -= 15;

  drawText(page, 'Total Paid / ჯამური თანხა', { x: marginX, y, size: 11, color: navy, fonts: boldFonts });
  drawText(page, formatMoney(data.totalAmount, data.currency), { x: col2, y, size: 11, color: navy, fonts: boldFonts, maxWidth: 100 });
  y -= 20;

  if (data.platformFee != null && data.netAmount != null) {
    drawText(page, 'Platform Fee (20%) / პლატფორმის საკომისიო', { x: marginX, y, size: 9, color: slate, fonts: regularFonts });
    drawText(page, `-${formatMoney(data.platformFee, data.currency)}`, { x: col2, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 100 });
    y -= 16;
    drawText(page, 'Net Amount / წმინდა თანხა', { x: marginX, y, size: 9, color: slate, fonts: regularFonts });
    drawText(page, formatMoney(data.netAmount, data.currency), { x: col2, y, size: 9, color: slate, fonts: regularFonts, maxWidth: 100 });
    y -= 16;
  }

  y -= 20;
  const statusLabel = data.status === 'PAID' ? 'PAID / გადახდილია' : 'REFUNDED / დაბრუნებულია';
  drawText(page, statusLabel, { x: marginX, y, size: 12, color: data.status === 'PAID' ? emerald : slate, fonts: boldFonts });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
