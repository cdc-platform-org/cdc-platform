import { AzureSpeechError } from '../azureSpeechService';

const mockSynthesize = jest.fn();
const mockIsTtsConfigured = jest.fn();
const mockIsBookAiMocked = jest.fn();

jest.mock('../azureSpeechService', () => {
  const actual = jest.requireActual('../azureSpeechService');
  return { ...actual, synthesizeSpeech: (...a: unknown[]) => mockSynthesize(...a), isTtsConfigured: () => mockIsTtsConfigured() };
});
jest.mock('../bookMockConfig', () => ({ isBookAiMocked: () => mockIsBookAiMocked() }));

import {
  AzureBookNarrationProvider,
  UnconfiguredBookNarrationProvider,
  getBookNarrationProvider,
} from '../bookNarrationProviders';
import { MockBookNarrationProvider } from '../bookNarrationService';

const MP3 = Buffer.from([0x49, 0x44, 0x33]);

beforeEach(() => {
  jest.clearAllMocks();
  mockSynthesize.mockResolvedValue(MP3);
});

describe('AzureBookNarrationProvider', () => {
  const provider = new AzureBookNarrationProvider({ voiceKa: 'ka-GE-GiorgiNeural', voiceEn: 'en-US-JennyNeural' });

  it('synthesizes Georgian pages with the configured KA voice and its locale', async () => {
    const result = await provider.generatePageNarration({ bookProjectId: 'b1', pageNumber: 2, language: 'KA', text: ' გამარჯობა ' });
    expect(mockSynthesize).toHaveBeenCalledWith(expect.objectContaining({ text: 'გამარჯობა', voiceShortName: 'ka-GE-GiorgiNeural', voiceLocale: 'ka-GE' }));
    expect(result.buffer).toBe(MP3);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.language).toBe('KA');
    expect(result.artifactKey).toBe('b1:page:2:0');
    expect(result.storageKey).toBe('books/b1/narration/b1-page-2-0.mp3');
  });

  it('uses the EN voice for English books and tracks revision versions in the key', async () => {
    const result = await provider.generatePageNarration({ bookProjectId: 'b1', pageNumber: 1, revisionVersion: 1, language: 'EN', text: 'Once upon a time' });
    expect(mockSynthesize).toHaveBeenCalledWith(expect.objectContaining({ voiceShortName: 'en-US-JennyNeural', voiceLocale: 'en-US' }));
    expect(result.storageKey).toBe('books/b1/narration/b1-page-1-1.mp3');
  });

  it('rejects blank page text without calling Azure', async () => {
    await expect(provider.generatePageNarration({ bookProjectId: 'b1', pageNumber: 3, language: 'KA', text: '   ' })).rejects.toMatchObject({ status: 400 });
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it('propagates Azure errors unchanged', async () => {
    mockSynthesize.mockRejectedValue(new AzureSpeechError('boom', 429));
    await expect(provider.generatePageNarration({ bookProjectId: 'b1', pageNumber: 1, language: 'EN', text: 'hi' })).rejects.toMatchObject({ status: 429 });
  });
});

describe('getBookNarrationProvider', () => {
  it('returns the mock when book AI is mocked (dev/tests)', () => {
    mockIsBookAiMocked.mockReturnValue(true);
    mockIsTtsConfigured.mockReturnValue(true);
    expect(getBookNarrationProvider()).toBeInstanceOf(MockBookNarrationProvider);
  });

  it('returns Azure when real and configured', () => {
    mockIsBookAiMocked.mockReturnValue(false);
    mockIsTtsConfigured.mockReturnValue(true);
    expect(getBookNarrationProvider()).toBeInstanceOf(AzureBookNarrationProvider);
  });

  it('returns a provider that fails with a clear 501 when real but unconfigured', async () => {
    mockIsBookAiMocked.mockReturnValue(false);
    mockIsTtsConfigured.mockReturnValue(false);
    const p = getBookNarrationProvider();
    expect(p).toBeInstanceOf(UnconfiguredBookNarrationProvider);
    await expect(p.generatePageNarration({ bookProjectId: 'b', pageNumber: 1, language: 'KA' } as never)).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('AZURE_SPEECH_KEY'),
    });
  });
});
