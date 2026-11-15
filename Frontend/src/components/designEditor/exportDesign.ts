// ============================================================
// Design export — PNG (one page) and PDF (all pages), rendered in the
// browser at print resolution with the same builders the editor uses
// (fabricMapping.ts), so the download matches the screen exactly,
// Georgian fonts included. The PDF holds one high-DPI image per page:
// ideal for printing; text is not selectable (accepted MVP trade-off).
// ============================================================
import { StaticCanvas } from 'fabric';
import { PDFDocument } from 'pdf-lib';
import type { DesignTemplate } from '../../types/designTemplate';
import { renderPage, type ImageCache } from './fabricMapping';
import { ensureDesignFontsLoaded } from './fonts';

export const PRINT_DPI = 300;
// Browsers refuse (or crash on) very large canvases; big posters get a
// slightly lower DPI instead of failing.
const MAX_EDGE_PX = 8000;

function pxPerMmFor(template: DesignTemplate, dpi: number): number {
  const wanted = dpi / 25.4;
  const longest = Math.max(template.page.widthMm, template.page.heightMm);
  return Math.min(wanted, MAX_EDGE_PX / longest);
}

async function renderPageToBlob(
  template: DesignTemplate, pageIndex: number, images: ImageCache, dpi: number, type: 'image/png' | 'image/jpeg', transparent = false,
): Promise<Blob> {
  await ensureDesignFontsLoaded();
  const pxPerMm = pxPerMmFor(template, dpi);
  const width = Math.round(template.page.widthMm * pxPerMm);
  const height = Math.round(template.page.heightMm * pxPerMm);
  const element = document.createElement('canvas');
  const canvas = new StaticCanvas(element, { width, height, enableRetinaScaling: false, renderOnAddRemove: false });
  try {
    renderPage(canvas, template, template.pages[pageIndex], pxPerMm, images, false);
    if (transparent) { canvas.backgroundColor = ''; canvas.backgroundImage = undefined; }
    canvas.renderAll();
    const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, type, 0.92));
    if (!blob) throw new Error('Canvas export failed');
    return blob;
  } finally {
    canvas.dispose();
  }
}

export async function exportPagePng(template: DesignTemplate, pageIndex: number, images: ImageCache, transparent = false): Promise<Blob> {
  return renderPageToBlob(template, pageIndex, images, PRINT_DPI, 'image/png', transparent);
}

export async function exportPdf(
  template: DesignTemplate, images: ImageCache, onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(template.title || 'Design');
  pdf.setCreator('CDC Design Editor');
  const widthPt = (template.page.widthMm / 25.4) * 72;
  const heightPt = (template.page.heightMm / 25.4) * 72;
  for (let index = 0; index < template.pages.length; index += 1) {
    // JPEG keeps a 300 DPI multi-page PDF a few MB instead of tens of MB.
    const blob = await renderPageToBlob(template, index, images, PRINT_DPI, 'image/jpeg');
    const jpg = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([widthPt, heightPt]);
    page.drawImage(jpg, { x: 0, y: 0, width: widthPt, height: heightPt });
    onProgress?.(index + 1, template.pages.length);
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(title: string): string {
  // Keep Georgian letters; drop only characters filesystems reject.
  return (title || 'design').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'design';
}
