import { PDFDocument } from 'pdf-lib';
import { buildBookPdf, parsePrintSettings, printFileSuffix, PrintSettings, BOOK_PDF_EXTRA_PAGES } from '../bookPdfService';

const MM = 72 / 25.4;

function pages(count: number, text = 'Mimi walks into the glowing forest and meets a friendly owl. ნინო იცინის.') {
  return Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1, storyText: text, imageBuffer: null, imageMimeType: null }));
}

async function sizes(print?: PrintSettings) {
  const pdf = await buildBookPdf({ title: 'Test', dedication: 'For Mimi', pageCount: 5, pages: pages(5), print });
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map((p) => ({ ...p.getSize(), trim: p.getTrimBox() }));
}

describe('book print settings', () => {
  it('defaults to A4 portrait', () => {
    const parsed = parsePrintSettings({});
    expect(parsed).toEqual({ ok: true, value: { size: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297, bleedMm: 0 } });
  });

  it('applies orientation to presets and keeps squares square', () => {
    expect(parsePrintSettings({ size: 'A5', orientation: 'landscape' })).toMatchObject({ ok: true, value: { widthMm: 210, heightMm: 148 } });
    expect(parsePrintSettings({ size: 'SQUARE_210', orientation: 'landscape' })).toMatchObject({ ok: true, value: { widthMm: 210, heightMm: 210 } });
  });

  it('accepts custom sizes within limits and refuses the rest', () => {
    expect(parsePrintSettings({ size: 'CUSTOM', widthMm: 240, heightMm: 170, bleedMm: 3 })).toMatchObject({ ok: true, value: { widthMm: 240, heightMm: 170, orientation: 'landscape', bleedMm: 3 } });
    for (const bad of [
      { size: 'CUSTOM', widthMm: 50, heightMm: 200 },
      { size: 'CUSTOM', widthMm: 200, heightMm: 900 },
      { size: 'CUSTOM', widthMm: 'abc', heightMm: 200 },
      { size: 'B9' },
      { size: 'A4', bleedMm: 7 },
      { size: 'A4', orientation: 'diagonal' },
      { size: '__proto__' },
    ]) {
      expect(parsePrintSettings(bad).ok).toBe(false);
    }
  });

  it('names print files by size', () => {
    const custom = parsePrintSettings({ size: 'CUSTOM', widthMm: 240, heightMm: 170, bleedMm: 3 });
    expect(custom.ok && printFileSuffix(custom.value)).toBe('240x170mm-bleed3mm');
  });

  it('builds the stored PDF at A4 by default', async () => {
    const result = await sizes();
    expect(result).toHaveLength(5 + BOOK_PDF_EXTRA_PAGES); // + front cover, title page, back cover
    expect(result[0].width).toBeCloseTo(595.28, 1);
    expect(result[0].height).toBeCloseTo(841.89, 1);
  });

  it('builds every page at the chosen size, with bleed outside the trim box', async () => {
    const parsed = parsePrintSettings({ size: 'CUSTOM', widthMm: 200, heightMm: 150, bleedMm: 3 });
    if (!parsed.ok) throw new Error(parsed.message);
    const result = await sizes(parsed.value);
    for (const page of result) {
      expect(page.width).toBeCloseTo(206 * MM, 1);
      expect(page.height).toBeCloseTo(156 * MM, 1);
      expect(page.trim.x).toBeCloseTo(3 * MM, 1);
      expect(page.trim.width).toBeCloseTo(200 * MM, 1);
    }
  });

  it('fits long edited text on a small page without failing', async () => {
    const parsed = parsePrintSettings({ size: 'CUSTOM', widthMm: 90, heightMm: 90 });
    if (!parsed.ok) throw new Error(parsed.message);
    const pdf = await buildBookPdf({ title: 'A very long title for a very small square book', dedication: null, pageCount: 5, pages: pages(5, 'word '.repeat(220)), print: parsed.value });
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
