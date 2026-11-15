// ============================================================
// SSML building + text clean-up for Azure neural TTS. Kept separate from
// azureSpeechService.ts (the HTTP wrapper) so the "make it sound natural"
// rules are pure functions that can be unit-tested without a Speech key.
//
// What makes a neural voice sound robotic in practice is rarely the voice
// itself — it is the input: markdown symbols read aloud, paragraphs glued
// together with no breath between them, a "+0%" prosody wrapper, emoji, or
// abbreviations ("მაგ.", "ა.შ.") read letter by letter or treated as a
// sentence end. Everything here targets one of those.
// ============================================================

// Azure neural voices are produced at 24 kHz. The previous
// 16khz-128kbitrate format downsampled them, which is what made narration
// sound muffled/"telephone-like". 24 kHz / 96 kbps mono is the native rate
// and is still small enough for long narrations.
export const AZURE_TTS_OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3';

// Trims the default silence Azure adds before/after the audio, so chunks
// played back-to-back (VIPAudioNarrator, book pages) don't have dead air.
const LEADING_SILENCE_MS = 80;
const TAILING_SILENCE_MS = 250;

export function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Common Georgian abbreviations that a TTS engine either spells out or
// mistakes for a sentence end (the trailing dot). Only unambiguous ones —
// e.g. "წ." (წელი/წლის/წელს) depends on grammatical case, so it is left
// for the engine. Order matters: "და ა.შ." must run before "ა.შ.".
const GEORGIAN_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/(^|[\s(,])და\s+ა\.\s?შ\./g, '$1და ასე შემდეგ'],
  [/(^|[\s(,])ა\.\s?შ\./g, '$1და ასე შემდეგ'],
  [/(^|[\s(,])ე\.\s?ი\./g, '$1ესე იგი'],
  [/(^|[\s(,])ე\.\s?წ\./g, '$1ეგრეთ წოდებული'],
  [/(^|[\s(,])მაგ\.(?=\s|,|:|$)/g, '$1მაგალითად'],
];

// Emoji / pictographs: neural voices either skip them silently or read their
// Unicode name ("smiling face with...") — both break the flow.
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/**
 * Cleans raw text (often markdown from AI replies, forum posts, lesson
 * notes) into something a voice can read naturally. Paragraph breaks are
 * preserved as "\n\n" so buildSsml can turn them into real pauses.
 */
export function normalizeTextForSpeech(input: string, locale: string): string {
  let text = input.replace(/\r\n?/g, '\n');

  // Markdown that would otherwise be read aloud or produce odd pauses.
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '$1.')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[*_~#|>]+/g, ' ');

  text = text.replace(EMOJI_RE, '');

  // Typographic normalization — smart quotes and long dashes are read
  // inconsistently; a spaced dash is a natural comma-length pause.
  text = text
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\s+[–—]\s+/g, ', ')
    .replace(/…/g, '...')
    .replace(/([!?])\1+/g, '$1')
    .replace(/\.{4,}/g, '...');

  if (locale.toLowerCase().startsWith('ka')) {
    for (const [pattern, replacement] of GEORGIAN_ABBREVIATIONS) text = text.replace(pattern, replacement);
  }

  // A line (list item, heading, paragraph) with no closing punctuation would
  // run straight into the next one with no intonation drop — end each one.
  const endSentence = (line: string) => (/[.!?:;,"')]$/.test(line) ? line : `${line}.`);

  // Collapse whitespace but keep paragraph boundaries.
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').replace(/\s+([,.!?:;])/g, '$1').trim())
        .filter(Boolean)
        .map(endSentence)
        .join(' ')
    )
    .filter(Boolean)
    .join('\n\n');
}

// UI speed multiplier (0.5-2.0, 1.0 = normal) -> SSML prosody rate. Returns
// null at 1.0 so no prosody wrapper is emitted — an explicit "+0%" wrapper
// is not free, it slightly flattens Azure's own natural intonation.
export function speedToProsodyRate(speed: number): string | null {
  const clamped = Math.max(0.5, Math.min(2, Number.isFinite(speed) ? speed : 1));
  const percent = Math.round((clamped - 1) * 100);
  if (percent === 0) return null;
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/**
 * Full SSML document for one synthesis request. `voiceShortName` and
 * `locale` are attribute values — callers must pass validated/allowlisted
 * values; they are still escaped here as defense in depth.
 */
export function buildSsml(params: { text: string; voiceShortName: string; locale: string; speed?: number; style?: string }): string {
  const locale = escapeSsml(params.locale);
  const voice = escapeSsml(params.voiceShortName);
  const normalized = normalizeTextForSpeech(params.text, params.locale);
  const body = normalized
    .split('\n\n')
    // Semantic paragraphs let the selected neural voice choose its own
    // phrasing and breaths rather than imposing the same pause everywhere.
    .map((paragraph) => `<p>${escapeSsml(paragraph)}</p>`)
    .join('');

  const rate = speedToProsodyRate(params.speed ?? 1);
  const paced = rate ? `<prosody rate="${rate}">${body}</prosody>` : body;
  // Only pass a style advertised by voices/list for this exact voice.
  const content = params.style ? `<mstts:express-as style="${escapeSsml(params.style)}">${paced}</mstts:express-as>` : paced;

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
    `<voice name="${voice}">` +
    `<mstts:silence type="Leading-exact" value="${LEADING_SILENCE_MS}ms"/>` +
    `<mstts:silence type="Tailing-exact" value="${TAILING_SILENCE_MS}ms"/>` +
    content +
    `</voice></speak>`
  );
}
