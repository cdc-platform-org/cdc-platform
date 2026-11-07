import fs from 'fs';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { buildBookPdf } from '../bookPdfService';
import { BOOK_FONT_IDS, BOOK_FONTS, DEFAULT_BOOK_FONT, isBookFontId, resolveBookFont } from '../bookFonts';

const TEXT = 'ნინო და Mimi ტყეში მიდიან — „რა ლამაზია!“ — 2026 ✨ said the owl.';

function pages(count: number) {
  return Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1, storyText: TEXT, imageBuffer: null, imageMimeType: null }));
}

// Font names embedded in a PDF (subset fonts carry a "ABCDEF+" prefix).
async function embeddedFontNames(pdf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const names = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    if (obj.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const base = obj.get(PDFName.of('BaseFont'));
    if (base) names.add(base.toString().replace(/^\//, '').replace(/^[A-Z]{6}\+/, ''));
  }
  return [...names];
}

describe('book fonts', () => {
  it('every font file exists and has Georgian and Latin coverage between its faces', () => {
    for (const id of BOOK_FONT_IDS) {
      const choice = BOOK_FONTS[id];
      for (const path of [choice.georgian.regular, choice.georgian.bold, choice.latin.regular, choice.latin.bold]) {
        expect(fs.existsSync(path)).toBe(true);
      }
    }
  });

  it('validates ids and falls back to the default', () => {
    expect(isBookFontId('FAIRYTALE')).toBe(true);
    expect(isBookFontId('__proto__')).toBe(false);
    expect(isBookFontId('Comic Sans')).toBe(false);
    expect(resolveBookFont(undefined)).toBe(DEFAULT_BOOK_FONT);
    expect(resolveBookFont('nope')).toBe(DEFAULT_BOOK_FONT);
    expect(resolveBookFont('PLAYFUL')).toBe('PLAYFUL');
  });

  it.each(BOOK_FONT_IDS)('builds a mixed Georgian/English PDF with %s', async (fontId) => {
    const pdf = await buildBookPdf({ title: 'ნინოს თავგადასავალი — Nino', dedication: 'Mimi-ს ❤', pageCount: 5, pages: pages(5), fontId });
    expect(pdf.length).toBeGreaterThan(1000);
    const names = await embeddedFontNames(pdf);
    expect(names.length).toBeGreaterThan(0);
  });

  it('uses different typefaces for different choices', async () => {
    const simple = await embeddedFontNames(await buildBookPdf({ title: 'Nino ნინო', dedication: null, pageCount: 5, pages: pages(5), fontId: 'SIMPLE' }));
    const fairytale = await embeddedFontNames(await buildBookPdf({ title: 'Nino ნინო', dedication: null, pageCount: 5, pages: pages(5), fontId: 'FAIRYTALE' }));
    expect(simple.some((n) => /NotoSansGeorgian/i.test(n))).toBe(true);
    expect(fairytale.some((n) => /Literata/i.test(n))).toBe(true);
    expect(fairytale.some((n) => /NotoSerifGeorgian/i.test(n))).toBe(true);
  });
});
