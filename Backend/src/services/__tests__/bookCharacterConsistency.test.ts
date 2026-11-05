jest.mock('../bookStorageService', () => ({ readBookAsset: jest.fn(async () => Buffer.from('portrait')) }));

import { loadCharacterReference, consistencyPromptLine } from '../bookCharacterDetailsService';
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

  it('tells the model to keep the same outfit on every page', () => {
    expect(consistencyPromptLine(true)).toMatch(/outfit/);
    expect(consistencyPromptLine(true)).toMatch(/reference portrait/);
    expect(consistencyPromptLine(false)).toMatch(/same outfit/);
  });
});
