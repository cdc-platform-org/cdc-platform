import type { BookLanguage } from '@prisma/client';

export const AUDIO_ADDON_PRICE_TETRI = 500;

export function calculateAudioPrice(audioAddOnPurchased: boolean): number {
  return audioAddOnPurchased ? AUDIO_ADDON_PRICE_TETRI : 0;
}

export function calculateTotalBookPrice(bookPriceTetri: number, audioAddOnPurchased: boolean): number {
  return bookPriceTetri + calculateAudioPrice(audioAddOnPurchased);
}

export function canGenerateNarration(params: { audioAddOnPurchased: boolean; paymentStatus: string }): boolean {
  return params.audioAddOnPurchased === true && [
    'PAID',
    'FINAL_GENERATING',
    'FINAL_QA',
    'FINAL_READY',
    'COMPLETED',
    'REVISION_REQUESTED',
    'REVISION_GENERATING',
    'REVISION_QA',
  ].includes(params.paymentStatus);
}

export function buildNarrationArtifactKey(params: { bookProjectId: string; pageNumber: number; revisionVersion: number }): string {
  return `${params.bookProjectId}:page:${params.pageNumber}:${params.revisionVersion}`;
}

export function narrationLanguageForBook(language: BookLanguage | string): BookLanguage {
  return language === 'KA' ? 'KA' : 'EN';
}

export interface NarrationGenerationResult {
  buffer: Buffer;
  mimeType: 'audio/wav';
  storageKey: string;
  language: BookLanguage;
  artifactKey: string;
}

export interface NarrationGenerationInput {
  bookProjectId: string;
  pageNumber: number;
  revisionVersion?: number;
  language: BookLanguage | string;
  text?: string | null;
}

export interface BookNarrationProvider {
  generatePageNarration(input: NarrationGenerationInput): Promise<NarrationGenerationResult>;
}

function createMockWavBuffer(seed: number): Buffer {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const durationMs = 1000;
  const sampleCount = Math.max(16, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 4, 'ascii');
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    const value = Math.sin((i / sampleRate) * 2 * Math.PI * (220 + (seed % 5) * 30)) * 12000;
    buffer.writeInt16LE(Math.round(value), 44 + i * 2);
  }

  return buffer;
}

export class MockBookNarrationProvider implements BookNarrationProvider {
  async generatePageNarration(input: NarrationGenerationInput): Promise<NarrationGenerationResult> {
    const language = narrationLanguageForBook(input.language);
    const revisionVersion = input.revisionVersion ?? 0;
    const artifactKey = buildNarrationArtifactKey({
      bookProjectId: input.bookProjectId,
      pageNumber: input.pageNumber,
      revisionVersion,
    });
    const storageKey = `books/${input.bookProjectId}/narration/${artifactKey.replace(/:/g, '-')}.wav`;
    const buffer = createMockWavBuffer(`${input.pageNumber}-${input.bookProjectId.length}-${revisionVersion}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));

    return {
      buffer,
      mimeType: 'audio/wav',
      storageKey,
      language,
      artifactKey,
    };
  }
}
