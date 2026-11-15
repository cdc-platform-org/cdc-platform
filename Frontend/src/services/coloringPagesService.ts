/**
 * API client for the AI coloring-page tool (backend: routes/coloringPages.ts
 * and routes/payments/coloringCreditsCheckout.ts).
 */
import apiClient from './apiClient';

export interface ColoringPack {
  id: string;
  credits: number;
  priceTetri: number;
}

export interface ColoringPageItem {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
}

export interface ColoringState {
  includedAccess?: boolean;
  balance: number;
  freeAvailable: boolean;
  packs: ColoringPack[];
  limits: { topicMaxLength: number; pagesPerHour: number };
  pages: ColoringPageItem[];
}

export type ColoringErrorCode = 'NOT_CONFIGURED' | 'INVALID_TOPIC' | 'RATE_LIMITED' | 'BUSY' | 'NO_CREDITS' | 'BLOCKED' | 'FAILED';

export async function getColoringState(): Promise<ColoringState> {
  const res = await apiClient.get<ColoringState>('/coloring-pages/me');
  return res.data;
}

// Drawing takes ~30-60 s, so this call gets a long timeout of its own.
export async function generateColoringPage(topic: string): Promise<{ page: ColoringPageItem; balance: number; freeAvailable: boolean }> {
  const res = await apiClient.post('/coloring-pages/generate', { topic }, { timeout: 180_000 });
  return res.data;
}

export async function fetchColoringPageBlob(id: string): Promise<Blob> {
  const res = await apiClient.get(`/coloring-pages/${id}/image`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function deleteColoringPage(id: string): Promise<void> {
  await apiClient.delete(`/coloring-pages/${id}`);
}

export async function buyColoringPack(packId: string, lang?: string): Promise<{ paymentId: string; redirectUrl: string | null }> {
  const res = await apiClient.post(`/payments/checkout/coloring-credits/${packId}`, { lang });
  return res.data;
}

// A one-page A4 PDF with the PNG centered — what parents actually print.
export async function pngToA4Pdf(png: Blob): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const img = await doc.embedPng(await png.arrayBuffer());
  const margin = 24;
  const scale = Math.min((page.getWidth() - margin * 2) / img.width, (page.getHeight() - margin * 2) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h });
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
