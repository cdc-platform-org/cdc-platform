import apiClient from './apiClient';

export type BookLanguage = 'KA' | 'EN';

export interface BookCharacterConfig {
  name: string;
  age?: number;
  traits?: string[];
  favoriteThing?: string;
  dedication?: string | null;
  previewImageKey?: string;
  previewImageMimeType?: string;
  previewEventId?: string;
}

export interface BookPage {
  id: string;
  pageNumber: number;
  storyText: string | null;
  imageGenerationStatus: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  qaStatus: 'PASS' | 'PARTIAL' | 'FAIL' | null;
  acceptedEventId: string | null;
  revisionVersion: number;
}

export interface BookNarrationArtifact {
  id: string;
  pageNumber: number;
  revisionVersion: number;
  status: string;
  language: BookLanguage;
  mimeType: string;
}

export interface AudioNarrationStatus {
  audioAddOnPurchased: boolean;
  audioPriceGel: number;
  totalPriceGel: number;
  eligible: boolean;
  artifacts: BookNarrationArtifact[];
}

export interface BookProject {
  id: string;
  userId: string;
  language: BookLanguage;
  title: string;
  status: string;
  pdfStatus: 'NONE' | 'GENERATING' | 'CURRENT' | 'STALE' | 'FAILED';
  illustrationStyle: string | null;
  priceGel: number;
  audioAddOnPurchased: boolean;
  audioPriceGel: number;
  totalPriceGel: number;
  pageCount: number;
  revisionLimit: number;
  revisionUsed: boolean;
  characterConfig: BookCharacterConfig | null;
  characterBible: Record<string, unknown> | null;
  styleBible: Record<string, unknown> | null;
  storyPlan: { title: string; dedication: string | null; pages: unknown[] } | null;
  finalPdfBlobRef: string | null;
  pdfVersion: number;
  createdAt: string;
  updatedAt: string;
  pages?: BookPage[];
}

export interface BookListItem {
  id: string;
  title: string;
  language: BookLanguage;
  status: string;
  pdfStatus: BookProject['pdfStatus'];
  pageCount: number;
  priceGel: number;
  audioAddOnPurchased: boolean;
  audioPriceGel: number;
  totalPriceGel: number;
  createdAt: string;
  updatedAt: string;
  illustrationStyle: string | null;
}

export async function listMyBooks(): Promise<BookListItem[]> {
  const response = await apiClient.get<{ data: BookListItem[] }>('/childrens-books');
  return response.data.data;
}

export async function getBook(id: string): Promise<{ book: BookProject; mocked: boolean; devPaymentSimulationEnabled: boolean }> {
  const response = await apiClient.get<{ data: BookProject; mocked: boolean; devPaymentSimulationEnabled: boolean }>(`/childrens-books/${id}`);
  return { book: response.data.data, mocked: response.data.mocked, devPaymentSimulationEnabled: response.data.devPaymentSimulationEnabled };
}

export async function createBook(payload: { language: BookLanguage; title: string; character: BookCharacterConfig; illustrationStyle?: string; pageCount: number }): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>('/childrens-books', payload);
  return response.data.data;
}

export async function updateCharacterConfig(id: string, payload: { character?: BookCharacterConfig; title?: string }): Promise<BookProject> {
  const response = await apiClient.put<{ data: BookProject }>(`/childrens-books/${id}/character-config`, payload);
  return response.data.data;
}

export async function generateStoryPlan(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/story-plan`);
  return response.data.data;
}

export async function generateCharacterPreview(id: string): Promise<{ book: BookProject; mocked: boolean }> {
  const response = await apiClient.post<{ data: BookProject; mocked: boolean }>(`/childrens-books/${id}/character-preview`);
  return { book: response.data.data, mocked: response.data.mocked };
}

// Auth on this app is a Bearer token in localStorage (apiClient's request
// interceptor), never a cookie — a plain <img src="..."> or <a href="...">
// to an authenticated route would never carry that header. Fetching the
// bytes through apiClient and handing the component a short-lived
// object URL is the correct pattern here; callers must revokeObjectURL
// when done (see the wizard page's cleanup effect).
export async function fetchCharacterPreviewImageUrl(id: string): Promise<string> {
  const response = await apiClient.get(`/childrens-books/${id}/character-preview/image`, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

export async function approveCharacter(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/character-approval`);
  return response.data.data;
}

export async function startCheckout(bookId: string): Promise<{ paymentId: string; redirectUrl: string | null }> {
  const response = await apiClient.post<{ paymentId: string; redirectUrl: string | null }>(`/payments/checkout/childrens-book/${bookId}`, {});
  return response.data;
}

export async function updateAudioUpgrade(id: string, audioAddOnPurchased: boolean): Promise<BookProject> {
  const response = await apiClient.patch<{ data: BookProject }>(`/childrens-books/${id}/audio-upgrade`, { audioAddOnPurchased });
  return response.data.data;
}

export async function getNarrationStatus(id: string): Promise<AudioNarrationStatus> {
  const response = await apiClient.get<{ data: AudioNarrationStatus }>(`/childrens-books/${id}/audio/status`);
  return response.data.data;
}

export async function generateNarration(id: string): Promise<AudioNarrationStatus> {
  const response = await apiClient.post<{ data: AudioNarrationStatus }>(`/childrens-books/${id}/audio/generate`);
  return response.data.data;
}

export async function fetchNarrationAudioUrl(id: string, pageNumber: number): Promise<string> {
  const response = await apiClient.get(`/childrens-books/${id}/audio/page/${pageNumber}`, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

export async function fetchBookPageImageUrl(id: string, pageNumber: number): Promise<string> {
  const response = await apiClient.get(`/childrens-books/${id}/page/${pageNumber}/image`, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

export async function devSimulatePayment(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/payment/dev-simulate`);
  return response.data.data;
}

export async function startFinalGeneration(id: string): Promise<{ book: BookProject; acceptedCount: number; mocked: boolean }> {
  const response = await apiClient.post<{ data: BookProject; acceptedCount: number; mocked: boolean }>(`/childrens-books/${id}/final-generation/start`);
  return { book: response.data.data, acceptedCount: response.data.acceptedCount, mocked: response.data.mocked };
}

export interface FinalGenerationStatus {
  status: string;
  pages: Array<{ pageNumber: number; imageGenerationStatus: BookPage['imageGenerationStatus']; qaStatus: BookPage['qaStatus']; accepted: boolean }>;
}

export async function getFinalGenerationStatus(id: string): Promise<FinalGenerationStatus> {
  const response = await apiClient.get<{ data: FinalGenerationStatus }>(`/childrens-books/${id}/final-generation/status`);
  return response.data.data;
}

export async function requestRevision(id: string, payload: { pageNumber: number; note?: string }): Promise<{ book: BookProject; qa: string }> {
  const response = await apiClient.post<{ data: BookProject; qa: string }>(`/childrens-books/${id}/revision`, payload);
  return { book: response.data.data, qa: response.data.qa };
}

export async function generatePdf(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/pdf`);
  return response.data.data;
}

export async function downloadBookPdf(id: string, filename: string): Promise<void> {
  const response = await apiClient.get(`/childrens-books/${id}/pdf/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
