import { AZURE_SPEECH_KEY, AZURE_SPEECH_REGION } from '../utils/env';

// ============================================================
// Azure AI Speech (Cognitive Services) — text-to-speech for the Media
// Studio tool's "multilingual voice narration" feature. Plain REST calls
// against the Speech resource's own regional endpoint rather than the
// microsoft-cognitiveservices-speech-sdk package — that SDK targets
// long-lived streaming/mic scenarios and pulls in native bindings; a
// single request-in, MP3-bytes-out synthesis call needs neither, so two
// plain fetch() calls (list voices, synthesize) is the simpler and lighter
// dependency-free choice, same "REST over SDK where REST is enough"
// posture as bogPaymentService.ts's own comment about the BOG SDK.
//
// Deliberately NOT requireEnv() at import time — same "optional until
// configured, 501 until set" posture as every other paid AI provider in
// this codebase (see utils/env.ts's own comment on these two vars).
// ============================================================

export class AzureSpeechError extends Error {
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'AzureSpeechError';
    this.status = status;
  }
}

export function isTtsConfigured(): boolean {
  return !!AZURE_SPEECH_KEY && !!AZURE_SPEECH_REGION;
}

function regionalHost(): string {
  return `${AZURE_SPEECH_REGION}.tts.speech.microsoft.com`;
}

export interface TtsVoice {
  shortName: string;
  locale: string;
  displayName: string;
  localName: string;
  gender: string;
}

// Azure's own voices/list response has many more fields (sample rate,
// style lists, secondary locales, ...) — only what the UI's voice picker
// actually needs is kept, same "narrow projection of an upstream response"
// posture as this codebase's other third-party API wrappers.
interface RawAzureVoice {
  ShortName: string;
  Locale: string;
  DisplayName: string;
  LocalName: string;
  Gender: string;
}

// Voice list changes rarely (Azure ships new ones a few times a year) and
// is identical for every caller of this deployment's Speech resource, so a
// single process-wide cache is safe — avoids a round trip to Azure on
// every page load of the voice picker. 6 hours is generous enough to never
// meaningfully lag a real Azure release while still recovering from a
// resource/region change without a redeploy.
let voiceCache: { voices: TtsVoice[]; fetchedAt: number } | null = null;
const VOICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function listVoices(): Promise<TtsVoice[]> {
  if (!isTtsConfigured()) {
    throw new AzureSpeechError('Azure Speech is not configured (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION missing).', 501);
  }
  if (voiceCache && Date.now() - voiceCache.fetchedAt < VOICE_CACHE_TTL_MS) {
    return voiceCache.voices;
  }

  const response = await fetch(`https://${regionalHost()}/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY },
  });
  if (!response.ok) {
    throw new AzureSpeechError(`Azure Speech voices/list request failed (HTTP ${response.status}).`, response.status === 401 || response.status === 403 ? 502 : 503);
  }
  const raw = (await response.json()) as RawAzureVoice[];
  const voices: TtsVoice[] = raw
    // Only Neural voices are offered — the older non-neural voices Azure
    // still lists sound noticeably more robotic and are being phased out
    // account-wide, no reason to surface them in a fresh UI.
    .filter((v) => v.ShortName.includes('Neural'))
    .map((v) => ({ shortName: v.ShortName, locale: v.Locale, displayName: v.DisplayName, localName: v.LocalName, gender: v.Gender }));

  voiceCache = { voices, fetchedAt: Date.now() };
  return voices;
}

// Azure's real-time (non-batch) synthesis endpoint rejects requests well
// before this on very long input in practice — capped here so a caller
// gets one clear, immediate error instead of an opaque upstream 400.
// Generous enough for a multi-page script (roughly 15-20 minutes of
// narration at typical speaking pace).
export const MAX_TTS_TEXT_LENGTH = 8000;

function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// speed is a plain 0.5-2.0 multiplier from the UI slider (1.0 = normal) —
// translated to SSML's percentage-based prosody rate here so the route/
// frontend never need to know SSML exists.
function speedToProsodyRate(speed: number): string {
  const clamped = Math.max(0.5, Math.min(2, speed));
  const percent = Math.round((clamped - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

export async function synthesizeSpeech(params: { text: string; voiceShortName: string; voiceLocale: string; speed: number }): Promise<Buffer> {
  if (!isTtsConfigured()) {
    throw new AzureSpeechError('Azure Speech is not configured (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION missing).', 501);
  }
  if (params.text.length > MAX_TTS_TEXT_LENGTH) {
    throw new AzureSpeechError(`Text is too long for a single narration (max ${MAX_TTS_TEXT_LENGTH} characters).`, 400);
  }

  const ssml =
    `<speak version="1.0" xml:lang="${escapeSsml(params.voiceLocale)}">` +
    `<voice name="${escapeSsml(params.voiceShortName)}">` +
    `<prosody rate="${speedToProsodyRate(params.speed)}">${escapeSsml(params.text)}</prosody>` +
    `</voice></speak>`;

  const response = await fetch(`https://${regionalHost()}/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent': 'cdc-platform-media-studio',
    },
    body: ssml,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AzureSpeechError(
      `Azure Speech synthesis failed (HTTP ${response.status}).${detail ? ` ${detail.slice(0, 300)}` : ''}`,
      response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 503
    );
  }
  return Buffer.from(await response.arrayBuffer());
}
