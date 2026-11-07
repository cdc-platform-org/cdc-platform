jest.mock('../bookStorageService', () => ({ readBookAsset: jest.fn(async () => Buffer.from('portrait')) }));

import { loadCharacterReference, consistencyPromptLine, pageStoryPromptLines } from '../bookCharacterDetailsService';
import { readBookAsset } from '../bookStorageService';

describe('character consistency across pages', () => {
  it('uses the approved portrait as reference even without a parent photo', async () => {
    const refs = await loadCharacterReference({ previewImageKey: 'books/b1/character-preview-e1.png', previewImageMimeType: 'image/png' });
    expect(readBookAsset).toHaveBeenCalledWith('books/b1/character-preview-e1.png');
    expect(refs).toHaveLength(1);
    expect(refs[0].mimeType).toBe('image/png');
  });

  it('returns no reference when there is no approved portrait', async () => {
    expect(await loadCharacterReference({})).toEqual([]);
    expect(await loadCharacterReference(null)).toEqual([]);
  });

  it('ties each picture to its page text and the child\'s real age', () => {
    const line = pageStoryPromptLines({ name: 'სოფი', age: 5 }, 'სოფიმ ჩანთა მოიმარჯვა და\n რუკის მიხედვით გზას დაადგა.');
    expect(line).toContain('5-year-old');
    expect(line).toContain('სოფიმ ჩანთა მოიმარჯვა და რუკის მიხედვით გზას დაადგა.');
    expect(pageStoryPromptLines({ name: 'x' }, '')).toBe('');
  });

  it('tells the model to keep the same outfit on every page', () => {
    expect(consistencyPromptLine(true)).toMatch(/outfit/);
    expect(consistencyPromptLine(true)).toMatch(/reference portrait/);
    expect(consistencyPromptLine(false)).toMatch(/same outfit/);
  });
});
