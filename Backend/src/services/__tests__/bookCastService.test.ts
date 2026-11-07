jest.mock('../aiAgentService', () => ({ callTextModel: jest.fn() }));
jest.mock('../bookMockConfig', () => ({ ...jest.requireActual('../bookMockConfig'), isBookAiMocked: jest.fn(() => false) }));
jest.mock('../bookImageGenerationService', () => ({ generateBookImage: jest.fn() }));
jest.mock('../bookStorageService', () => ({ storeBookAsset: jest.fn(async () => undefined), readBookAsset: jest.fn(async () => Buffer.from('sheet')) }));

import { callTextModel } from '../aiAgentService';
import { generateBookImage } from '../bookImageGenerationService';
import { castPromptLine, ensureBookCast, BookCast } from '../bookCastService';

const look = 'a small round lavender creature the size of a cat, with big turquoise eyes and a glowing blue swirl tail';

describe('castPromptLine', () => {
  it('repeats the fixed design of the characters on that page and points at the sheet', () => {
    const cast: BookCast = { characters: [{ name: 'Lumi', look, pages: [4, 5] }, { name: 'Owl', look: 'a big brown owl with amber eyes', pages: [10] }], sheetKey: 'k' };
    const line = castPromptLine(cast, 5, true);
    expect(line).toContain('Lumi');
    expect(line).toContain('turquoise eyes');
    expect(line).not.toContain('Owl');
    expect(line).toContain('character sheet');
  });

  it('is empty without a cast', () => {
    expect(castPromptLine(null, 1, false)).toBe('');
  });
});

describe('ensureBookCast', () => {
  beforeEach(() => {
    jest.mocked(callTextModel).mockReset();
    jest.mocked(generateBookImage).mockReset();
  });

  const base = {
    bookId: 'b1',
    characterBible: { name: 'სოფი' },
    illustrationStyle: 'MODERN_3D',
    pages: [{ pageNumber: 1, storyText: 'სოფიმ ჯადოსნური არსება ლუმი გაიცნო.' }],
  };

  it('extracts the cast once, draws one sheet and saves both for every later run', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(JSON.stringify({ characters: [{ name: 'Lumi', look, pages: [1] }] }));
    jest.mocked(generateBookImage).mockResolvedValueOnce({ success: true, deployment: 'd', latencyMs: 1, requestId: null, mimeType: 'image/png', byteSize: 5, buffer: Buffer.from('sheet') });
    const saved: BookCast[] = [];
    const result = await ensureBookCast({ ...base, storyPlan: { pages: [] }, saveCast: async (c) => { saved.push(c); } });
    expect(result.cast?.characters[0].name).toBe('Lumi');
    expect(result.sheetReference).toHaveLength(1);
    expect(saved[0].sheetKey).toBe('books/b1/cast-sheet.png');
    expect(jest.mocked(generateBookImage).mock.calls[0][0].prompt).toContain('turquoise eyes');
  });

  it('reuses a saved cast without any new AI call', async () => {
    const result = await ensureBookCast({ ...base, storyPlan: { cast: { characters: [{ name: 'Lumi', look, pages: [] }], sheetKey: 'books/b1/cast-sheet.png', sheetMimeType: 'image/png' } }, saveCast: async () => {} });
    expect(result.cast?.characters).toHaveLength(1);
    expect(result.sheetReference).toHaveLength(1);
    expect(callTextModel).not.toHaveBeenCalled();
    expect(generateBookImage).not.toHaveBeenCalled();
  });

  it('never blocks the book: a text-model failure means no cast', async () => {
    jest.mocked(callTextModel).mockRejectedValueOnce(new Error('503'));
    const result = await ensureBookCast({ ...base, storyPlan: { pages: [] }, saveCast: async () => {} });
    expect(result.cast).toBeNull();
    expect(result.sheetReference).toEqual([]);
  });
});
