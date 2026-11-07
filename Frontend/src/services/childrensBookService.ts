import apiClient, { API_BASE_URL } from './apiClient';

export type BookLanguage = 'KA' | 'EN';

export interface BookSibling {
  name: string;
  age?: number;
  appearance?: string;
  photoKey?: string;
  photoMimeType?: string;
}

export interface BookCharacterConfig {
  name: string;
  age?: number;
  traits?: string[];
  favoriteThing?: string;
  dedication?: string | null;
  appearance?: string;
  extraCharacters?: string;
  siblings?: BookSibling[];
  photoKey?: string;
  photoConsentAt?: string;
  photoDeletedAt?: string;
  photoMimeType?: string;
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
  storyPlan: { title: string; dedication: string | null; pages: unknown[]; textApprovedAt?: string | null; textRegenerations?: number } | null;
  finalPdfBlobRef: string | null;
  pdfVersion: number;
  previewConfirmedAt: string | null;
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
  generationRecovering?: boolean;
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

// Books made before real story text existed still carry the placeholder
// template ("… — გვერდი 2."); the backend rewrites only the words.
const PLACEHOLDER_STORY_TEXT = [/ახალ თავგადასავალს — გვერდი \d+\.?$/, /a new page in the adventure \(page \d+\)\.?$/];

export function hasPlaceholderStoryText(book: BookProject): boolean {
  return (book.pages ?? []).some((p) => !p.storyText?.trim() || PLACEHOLDER_STORY_TEXT.some((re) => re.test(p.storyText!.trim())));
}

export async function rewriteStoryText(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/story-text/rewrite`);
  return response.data.data;
}

// Story text review: the parent reads and edits the text, then approves it.
// No image is generated for a new book before approval. Must match
// Backend/src/services/bookStoryTextService.ts.
export const MAX_EDITED_STORY_TEXT_LENGTH = 1200;
export const MAX_STORY_TEXT_REGENERATIONS = 3;
export type StoryTextEdit = { pageNumber: number; storyText: string };

export async function updateStoryText(id: string, pages: StoryTextEdit[]): Promise<BookProject> {
  const response = await apiClient.put<{ data: BookProject }>(`/childrens-books/${id}/story-text`, { pages });
  return response.data.data;
}

export async function approveStoryText(id: string, pages?: StoryTextEdit[]): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/story-text/approve`, pages?.length ? { pages } : {});
  return response.data.data;
}

export async function regenerateStoryText(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/story-text/regenerate`);
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

// `sibling` (0-based) targets that sibling's photo instead of the main character's.
function photoPath(id: string, sibling?: number): string {
  return `/childrens-books/${id}/character-photo${sibling === undefined ? '' : `?sibling=${sibling}`}`;
}

export async function uploadCharacterPhoto(id: string, file: File, sibling?: number): Promise<BookProject> {
  const formData = new FormData();
  // The UI only lets a photo be picked after the consent box is ticked.
  formData.append('consent', 'true');
  formData.append('photo', file);
  const response = await apiClient.post<{ data: BookProject }>(photoPath(id, sibling), formData);
  return response.data.data;
}

export async function removeCharacterPhoto(id: string, sibling?: number): Promise<BookProject> {
  const response = await apiClient.delete<{ data: BookProject }>(photoPath(id, sibling));
  return response.data.data;
}

// Same blob/object-URL pattern as fetchCharacterPreviewImageUrl.
export async function fetchCharacterPhotoUrl(id: string, sibling?: number): Promise<string> {
  const response = await apiClient.get(photoPath(id, sibling), { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

export async function confirmBookPreview(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/preview-confirm`);
  return response.data.data;
}

export async function approveCharacter(id: string): Promise<BookProject> {
  const response = await apiClient.post<{ data: BookProject }>(`/childrens-books/${id}/character-approval`);
  return response.data.data;
}

export async function startCheckout(bookId: string, promoCode?: string): Promise<{ paymentId: string; redirectUrl: string | null; purchased?: boolean }> {
  const response = await apiClient.post<{ paymentId: string; redirectUrl: string | null; purchased?: boolean }>(`/payments/checkout/childrens-book/${bookId}`, promoCode ? { promoCode } : {});
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

// Print-ready PDF at a chosen paper size. Must match
// Backend/src/services/bookPdfService.ts (PRINT_SIZE_PRESETS and limits).
export type PrintSizePreset = 'A4' | 'A5' | 'A3' | 'LETTER' | 'SQUARE_210' | 'SQUARE_200';
export const PRINT_SIZE_PRESETS: Record<PrintSizePreset, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  A3: { widthMm: 297, heightMm: 420 },
  LETTER: { widthMm: 215.9, heightMm: 279.4 },
  SQUARE_210: { widthMm: 210, heightMm: 210 },
  SQUARE_200: { widthMm: 200, heightMm: 200 },
};
export const CUSTOM_PRINT_SIZE_MIN_MM = 90;
export const CUSTOM_PRINT_SIZE_MAX_MM = 500;
export interface PrintRequest {
  size: PrintSizePreset | 'CUSTOM';
  orientation: 'portrait' | 'landscape';
  widthMm?: number;
  heightMm?: number;
  bleedMm: 0 | 3 | 5;
}

export async function downloadPrintPdf(id: string, settings: PrintRequest, filename: string): Promise<void> {
  const response = await apiClient.post(`/childrens-books/${id}/pdf/print`, settings, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Public sample picture of an illustration style (drawn once by the
// backend and cached), used by the style picker as a plain <img src>.
export function styleSampleUrl(style: string): string {
  return `${API_BASE_URL}/childrens-books/style-samples/${encodeURIComponent(style)}`;
}
