import apiClient from './apiClient';

// ============================================================
// AI Voice & Video Media Studio — Frontend API client for both features:
// Feature A (Backend's routes/tts.ts) and Feature B (routes/mediaStudio.ts).
// ============================================================

export interface TtsVoice {
  shortName: string;
  locale: string;
  displayName: string;
  localName: string;
  gender: string;
}

export async function getTtsVoices(): Promise<TtsVoice[]> {
  // Backend's own Azure fetch is bounded at 20s (see azureSpeechService.ts's
  // AZURE_SPEECH_REQUEST_TIMEOUT_MS) — this stays a bit above that so the
  // backend's own clear timeout error reaches the UI instead of axios's
  // generic one winning the race.
  const response = await apiClient.get<{ data: TtsVoice[] }>('/tts/voices', { timeout: 25 * 1000 });
  return response.data.data;
}

export interface SynthesizeSpeechPayload {
  text: string;
  voiceShortName: string;
  voiceLocale: string;
  speed: number;
}

// Returns a playable/downloadable Blob directly — the backend streams raw
// MP3 bytes rather than a JSON envelope (see routes/tts.ts's Content-Type).
export async function synthesizeSpeech(payload: SynthesizeSpeechPayload): Promise<Blob> {
  // Backend's own Azure fetch is bounded at 60s — see synthesize's comment
  // in getTtsVoices() above for why the client stays a bit above that.
  const response = await apiClient.post('/tts/synthesize', payload, { responseType: 'blob', timeout: 70 * 1000 });
  return response.data;
}

export interface TranscriptionResult {
  transcript: string;
  notes: string;
}

export async function transcribeVideoUpload(file: File): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('video', file);
  // Uploads can genuinely take a couple of minutes (large file + ffmpeg
  // extraction + Gemini File API processing) — the default axios timeout
  // would otherwise abort a perfectly healthy request.
  const response = await apiClient.post<{ data: TranscriptionResult }>('/media-studio/transcribe', formData, { timeout: 6 * 60 * 1000 });
  return response.data.data;
}

export async function transcribeYoutubeUrl(youtubeUrl: string): Promise<TranscriptionResult> {
  const response = await apiClient.post<{ data: TranscriptionResult }>(
    '/media-studio/transcribe',
    { youtubeUrl },
    { timeout: 6 * 60 * 1000 }
  );
  return response.data.data;
}

export async function sendMediaStudioEmail(payload: { to: string; transcript?: string; notes?: string; lang?: 'ka' | 'en' }): Promise<void> {
  await apiClient.post('/media-studio/email', payload);
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const response = await apiClient.post<{ data: { translation: string } }>('/media-studio/translate', { text, targetLanguage });
  return response.data.data.translation;
}
