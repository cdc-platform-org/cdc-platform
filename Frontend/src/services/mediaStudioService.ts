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
  const response = await apiClient.get<{ data: TtsVoice[] }>('/tts/voices');
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
  const response = await apiClient.post('/tts/synthesize', payload, { responseType: 'blob' });
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
