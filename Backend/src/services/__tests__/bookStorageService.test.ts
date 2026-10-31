jest.mock('../privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn(),
  getSignedBlobUrl: jest.fn(),
  deletePrivateBlob: jest.fn(),
  downloadPrivateBlob: jest.fn(async () => Buffer.from('blob-bytes')),
}));
jest.mock('../bookMockConfig', () => ({ shouldUseCloudBookStorage: jest.fn() }));

import { readBookAsset } from '../bookStorageService';
import { downloadPrivateBlob } from '../privateBlobStorage';
import { shouldUseCloudBookStorage } from '../bookMockConfig';

describe('readBookAsset', () => {
  it('reads bytes from private Blob Storage in cloud mode (no SAS redirect)', async () => {
    jest.mocked(shouldUseCloudBookStorage).mockReturnValue(true);
    const buffer = await readBookAsset('books/b1/character-preview-e1.png');
    expect(downloadPrivateBlob).toHaveBeenCalledWith('books/b1/character-preview-e1.png');
    expect(buffer.toString()).toBe('blob-bytes');
  });

  it('reads from local disk when cloud storage is off', async () => {
    jest.mocked(shouldUseCloudBookStorage).mockReturnValue(false);
    jest.mocked(downloadPrivateBlob).mockClear();
    await expect(readBookAsset('books/missing/none.png')).rejects.toThrow();
    expect(downloadPrivateBlob).not.toHaveBeenCalled();
  });
});
