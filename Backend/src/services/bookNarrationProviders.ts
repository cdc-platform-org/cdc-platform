import { AZURE_SPEECH_VOICE, AZURE_SPEECH_VOICE_EN } from '../utils/env';
import { isBookAiMocked } from './bookMockConfig';
import { AzureSpeechError, isTtsConfigured, synthesizeSpeech } from './azureSpeechService';
import {
  BookNarrationProvider,
  MockBookNarrationProvider,
  NarrationGenerationInput,
  NarrationGenerationResult,
  buildNarrationArtifactKey,
  narrationLanguageForBook,
} from './bookNarrationService';

// Slightly slower than conversational pace — a children's story read-aloud.
const BOOK_NARRATION_SPEED = 0.9;

// "ka-GE-EkaNeural" -> "ka-GE"
function localeOfVoice(voiceShortName: string): string {
  return voiceShortName.split('-').slice(0, 2).join('-');
}

export interface AzureBookNarrationOptions {
  voiceKa?: string;
  voiceEn?: string;
}

// Real narration through the existing Media Studio Azure Speech wrapper
// (azureSpeechService.ts). Output is that wrapper's MP3 (16kHz/128kbps mono),
// stored under a .mp3 key with audio/mpeg — the audio routes serve whatever
// mimeType the artifact row records, so no route change is needed for it.
export class AzureBookNarrationProvider implements BookNarrationProvider {
  private readonly voiceKa: string;
  private readonly voiceEn: string;

  constructor(options: AzureBookNarrationOptions = {}) {
    this.voiceKa = options.voiceKa ?? AZURE_SPEECH_VOICE;
    this.voiceEn = options.voiceEn ?? AZURE_SPEECH_VOICE_EN;
  }

  voiceFor(language: string): string {
    return narrationLanguageForBook(language) === 'KA' ? this.voiceKa : this.voiceEn;
  }

  async generatePageNarration(input: NarrationGenerationInput): Promise<NarrationGenerationResult> {
    const language = narrationLanguageForBook(input.language);
    const text = (input.text ?? '').trim();
    if (!text) {
      throw new AzureSpeechError(`Page ${input.pageNumber} has no story text to narrate.`, 400);
    }

    const voice = this.voiceFor(language);
    const buffer = await synthesizeSpeech({
      text,
      voiceShortName: voice,
      voiceLocale: localeOfVoice(voice),
      speed: BOOK_NARRATION_SPEED,
    });

    const revisionVersion = input.revisionVersion ?? 0;
    const artifactKey = buildNarrationArtifactKey({ bookProjectId: input.bookProjectId, pageNumber: input.pageNumber, revisionVersion });
    return {
      buffer,
      mimeType: 'audio/mpeg',
      storageKey: `books/${input.bookProjectId}/narration/${artifactKey.replace(/:/g, '-')}.mp3`,
      language,
      artifactKey,
    };
  }
}

// Used in production when Azure Speech isn't configured: lets the app boot
// and every non-audio route work, while the audio endpoints fail with a
// clear 501 instead of silently serving the mock tone.
export class UnconfiguredBookNarrationProvider implements BookNarrationProvider {
  async generatePageNarration(): Promise<NarrationGenerationResult> {
    throw new AzureSpeechError('Audio narration is not available: Azure Speech is not configured (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION missing).', 501);
  }
}

// Same mock/real rule as the rest of the book pipeline (bookMockConfig.ts):
// production is always real, other environments mock unless
// BOOK_FORCE_REAL_AI=true. Resolved per call so a misconfigured production
// deploy degrades to a 501 on the audio routes rather than failing at import.
export function getBookNarrationProvider(): BookNarrationProvider {
  if (isBookAiMocked()) return new MockBookNarrationProvider();
  return isTtsConfigured() ? new AzureBookNarrationProvider() : new UnconfiguredBookNarrationProvider();
}
