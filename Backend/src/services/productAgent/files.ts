/**
 * Product agent — file helpers: artwork → print-ready PDF, PDF → page
 * previews, and print-size maths.
 * Exports: PrintSpec, PORTRAIT_PRINT_SPECS, SQUARE_PRINT_SPECS, printPdfFromArtwork,
 * renderPdfPages, cmLabel, inchLabel.
 */
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

export interface PrintSpec {
  // Short id used in file names, e.g. "2x3".
  ratioId: string;
  ratioLabel: string;
  // Largest print size of this ratio at 300 DPI; any smaller size of the
  // same ratio prints from the same file.
  widthPx: number;
  heightPx: number;
  // Common frame sizes this file fits, shown in the listing text.
  fitsKa: string;
  fitsEn: string;
}

// The standard set wall-art shops ship so one purchase fits almost every
// ready-made frame. All crop from one portrait 2:3 artwork.
export const PORTRAIT_PRINT_SPECS: PrintSpec[] = [
  { ratioId: '2x3', ratioLabel: '2:3', widthPx: 4800, heightPx: 7200, fitsKa: '20×30, 40×60, 60×90 სმ; 4×6, 8×12, 16×24 დიუმი', fitsEn: '20×30, 40×60, 60×90 cm; 4×6, 8×12, 16×24 in' },
  { ratioId: '3x4', ratioLabel: '3:4', widthPx: 5400, heightPx: 7200, fitsKa: '30×40, 45×60 სმ; 6×8, 9×12, 18×24 დიუმი', fitsEn: '30×40, 45×60 cm; 6×8, 9×12, 18×24 in' },
  { ratioId: '4x5', ratioLabel: '4:5', widthPx: 4800, heightPx: 6000, fitsKa: '40×50 სმ; 8×10, 16×20 დიუმი', fitsEn: '40×50 cm; 8×10, 16×20 in' },
  { ratioId: 'ISO', ratioLabel: 'A (ISO)', widthPx: 4961, heightPx: 7016, fitsKa: 'A5, A4, A3, A2', fitsEn: 'A5, A4, A3, A2' },
  { ratioId: '11x14', ratioLabel: '11:14', widthPx: 3300, heightPx: 4200, fitsKa: '28×35.5 სმ; 11×14 დიუმი', fitsEn: '28×35.5 cm; 11×14 in' },
];

// Square sets: same 4266 px file the admin's own floral set ships, plus a
// larger one for big frames.
export const SQUARE_PRINT_SPECS: PrintSpec[] = [
  { ratioId: '1x1', ratioLabel: '1:1', widthPx: 6000, heightPx: 6000, fitsKa: '20×20, 30×30, 40×40, 50×50 სმ; 8×8, 12×12, 20×20 დიუმი', fitsEn: '20×20, 30×30, 40×40, 50×50 cm; 8×8, 12×12, 20×20 in' },
];

export const cmLabel = (px: number) => (Math.round((px / 300) * 2.54 * 100) / 100).toString();
export const inchLabel = (px: number) => (Math.round((px / 300) * 100) / 100).toString();

// Centre-crop the artwork to the spec's ratio, upscale to its 300 DPI size
// (Lanczos + light sharpening keeps painterly/flat artwork crisp at print
// size), and wrap it in a one-page PDF whose page is the physical print size.
export async function printPdfFromArtwork(art: Buffer, spec: PrintSpec, title: string): Promise<Buffer> {
  const jpeg = await sharp(art, { limitInputPixels: false })
    .resize(spec.widthPx, spec.heightPx, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.8 })
    .withMetadata({ density: 300 })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('CDC Studio');
  const img = await doc.embedJpg(jpeg);
  const wPt = (spec.widthPx / 300) * 72;
  const hPt = (spec.heightPx / 300) * 72;
  const page = doc.addPage([wPt, hPt]);
  page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
  return Buffer.from(await doc.save());
}

// PNG renders of the first `count` pages, `width` px wide — used for the
// store mockups of document products.
export async function renderPdfPages(pdf: Buffer, count: number, width = 1100): Promise<Buffer[]> {
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const result = await parser.getScreenshot({ first: count, desiredWidth: width, imageDataUrl: false, imageBuffer: true } as any);
    return result.pages.map((p: any) => Buffer.from(p.data));
  } finally {
    await parser.destroy();
  }
}
