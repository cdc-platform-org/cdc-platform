import { getAdapterForProvider, getStorage, uploadToSpace } from '../index';
import { BunnyStorageAdapter } from '../bunnyAdapter';
import { AzureBlobAdapter } from '../azureBlobAdapter';
import { LocalStorageAdapter } from '../localAdapter';
import { WrongSpaceVisibilityError, StorageNotConfiguredError } from '../types';
import { SPACES } from '../config';
import * as bunnyStorage from '../../bunnyStorage';
import * as privateBlobStorage from '../../privateBlobStorage';

// ============================================================
// Phase A storage-abstraction tests — the adapters are unit-tested with
// the REAL underlying service modules jest.mock()ed, so no network or
// Azure credentials are needed and no actual file is ever written or
// deleted (the whole point of Phase A).
// ============================================================

jest.mock('../../bunnyStorage', () => ({
  isBunnyStorageConfigured: jest.fn(),
  uploadToBunnyStorage: jest.fn(),
  deleteFromBunnyStorage: jest.fn(),
  deleteBunnyStorageUrlIfManaged: jest.fn(),
  extractBunnyStorageUrls: jest.fn(),
}));
// Pin the env-derived URL bases so adapter URL tests don't depend on the
// developer's real .env (BUNNY_CDN_URL, BACKEND_URL).
jest.mock('../../../utils/env', () => ({
  BUNNY_CDN_URL: 'https://cdn.example.test',
  BACKEND_URL: 'https://api.example.test',
}));
jest.mock('../../privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn(),
  getSignedBlobUrl: jest.fn(),
  privateBlobExists: jest.fn(),
  privateContainerReady: Promise.resolve(),
  assertPrivateBlobContainer: jest.fn(),
}));
// localAdapter computes its root from __dirname — point it at a throwaway
// temp dir for the one test that touches it.
jest.mock('path', () => {
  const actual = jest.requireActual('path') as typeof import('path');
  return { ...actual, join: (...args: string[]) => actual.join(...args) };
});

const configuredEnv = process.env.AZURE_STORAGE_ACCOUNT_URL;
beforeAll(() => {
  process.env.AZURE_STORAGE_ACCOUNT_URL = 'https://testaccount.blob.core.windows.net';
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'test-container';
});
afterAll(() => {
  process.env.AZURE_STORAGE_ACCOUNT_URL = configuredEnv;
});

describe('provider selection (space → adapter)', () => {
  it('resolves each space to the provider it uses today', () => {
    expect(getStorage('public-images')).toBeInstanceOf(BunnyStorageAdapter);
    expect(getStorage('product-videos')).toBeInstanceOf(BunnyStorageAdapter);
    expect(getStorage('training-assets')).toBeInstanceOf(BunnyStorageAdapter);
    expect(getStorage('product-files')).toBeInstanceOf(AzureBlobAdapter);
    expect(getStorage('private-media')).toBeInstanceOf(AzureBlobAdapter);
    expect(getStorage('generated-assets')).toBeInstanceOf(AzureBlobAdapter);
  });

  it('every space in config maps to a real provider and non-empty defaults', () => {
    for (const space of Object.keys(SPACES) as Array<keyof typeof SPACES>) {
      const cfg = SPACES[space];
      expect(['bunny', 'azure-blob', 'local']).toContain(cfg.provider);
      expect(typeof cfg.visibility.public).toBe('boolean');
      expect(getAdapterForProvider(cfg.provider)).toBeDefined();
    }
  });
});

describe('bunny adapter (public images/videos — existing behavior)', () => {
  beforeEach(() => {
    jest.mocked(bunnyStorage.isBunnyStorageConfigured).mockReturnValue(true);
    jest.mocked(bunnyStorage.uploadToBunnyStorage).mockResolvedValue('https://cdn.example.test/images/a.webp');
  });

  it('delegates upload and returns the existing-service URL untouched', async () => {
    const adapter = getStorage('public-images');
    const result = await adapter.upload('public-images', { buffer: Buffer.from('x'), contentType: 'image/webp', filename: 'a.webp', folder: 'images' });
    expect(bunnyStorage.uploadToBunnyStorage).toHaveBeenCalledWith({ buffer: Buffer.from('x'), mimetype: 'image/webp', folderName: 'images', filename: 'a.webp' });
    expect(result.url).toBe('https://cdn.example.test/images/a.webp');
    expect(result.provider).toBe('bunny');
    expect(result.space).toBe('public-images');
  });

  it('unconfigured provider raises StorageNotConfiguredError instead of silently failing', async () => {
    jest.mocked(bunnyStorage.isBunnyStorageConfigured).mockReturnValue(false);
    const adapter = getStorage('public-images');
    try { await adapter.upload('public-images', { buffer: Buffer.from('x'), contentType: 'text/plain', filename: 'f.txt' }); throw new Error('should have thrown'); } catch (err) { expect(err).toBeInstanceOf(StorageNotConfiguredError); }
  });

  it('unconfigured provider raises StorageNotConfiguredError instead of silently failing (async)', async () => {
    jest.mocked(bunnyStorage.isBunnyStorageConfigured).mockReturnValue(false);
    const adapter = getStorage('public-images');
    try { await adapter.upload('public-images', { buffer: Buffer.from('x'), contentType: 'text/plain', filename: 'f.txt' }); throw new Error('should have thrown'); } catch (err) { expect(err).toBeInstanceOf(StorageNotConfiguredError); }
  });

  it('getPublicUrl builds the CDN URL and getAuthorizedDownload is refused for public spaces', async () => {
    const adapter = getStorage('public-images') as BunnyStorageAdapter;
    expect(adapter.getPublicUrl('public-images', 'images/a.webp')).toBe('https://cdn.example.test/images/a.webp');
    try { await adapter.getAuthorizedDownload('public-images', 'images/a.webp'); throw new Error('should have thrown'); } catch (err) { expect(err).toBeInstanceOf(WrongSpaceVisibilityError); }
  });

  it('urlIsManaged accepts our CDN URLs and rejects local/external URLs', async () => {
    const adapter = getStorage('public-images') as BunnyStorageAdapter;
    jest.mocked(bunnyStorage.isBunnyStorageConfigured).mockReturnValue(true);
    expect(adapter.urlIsManaged('public-images', 'https://cdn.example.test/images/a.webp')).toBe(true);
    expect(adapter.urlIsManaged('public-images', 'https://api.example.test/uploads/images/a.webp')).toBe(true);
    expect(adapter.urlIsManaged('public-images', 'https://evil.example.test/x.png')).toBe(false);
  });
});

describe('azure-blob adapter (private product files — existing behavior)', () => {
  beforeEach(() => {
    jest.mocked(privateBlobStorage.uploadPrivateBlob).mockResolvedValue(undefined);
    jest.mocked(privateBlobStorage.getSignedBlobUrl).mockResolvedValue('https://testaccount.blob.core.windows.net/test-container/product-file-1?sig=xxx');
    jest.mocked(privateBlobStorage.privateBlobExists).mockResolvedValue(true);
  });

  it('upload delegates and returns a cdcblob:// marker (not a signed URL)', async () => {
    const adapter = getStorage('product-files');
    const result = await adapter.upload('product-files', { buffer: Buffer.from('pdf'), contentType: 'application/pdf', filename: 'product-file-1-abc.pdf' });
    expect(privateBlobStorage.uploadPrivateBlob).toHaveBeenCalledWith('product-file-1-abc.pdf', Buffer.from('pdf'), 'application/pdf');
    expect(result.url).toBe('cdcblob://product-file-1-abc.pdf');
    expect(result.provider).toBe('azure-blob');
  });

  it('getAuthorizedDownload mints a short-lived signed URL', async () => {
    const adapter = getStorage('product-files');
    const download = await adapter.getAuthorizedDownload('product-files', 'product-file-1-abc.pdf', 10);
    expect(privateBlobStorage.getSignedBlobUrl).toHaveBeenCalledWith('product-file-1-abc.pdf', 10);
    expect(download.expiresInMinutes).toBe(10);
    expect(download.url).toContain('?sig=xxx');
  });

  it('getPublicUrl is refused for private spaces', () => {
    const adapter = getStorage('product-files');
    expect(() => adapter.getPublicUrl('product-files', 'x.pdf')).toThrow(WrongSpaceVisibilityError);
  });

  it('urlIsManaged recognizes only cdcblob:// markers', () => {
    const adapter = getStorage('product-files') as AzureBlobAdapter;
    expect(adapter.urlIsManaged('product-files', 'cdcblob://product-file-1-abc.pdf')).toBe(true);
    expect(adapter.urlIsManaged('product-files', 'https://anything.else/x.pdf')).toBe(false);
    expect(adapter.urlIsManaged('product-files', null)).toBe(false);
  });
});

describe('facade convenience', () => {
  it('uploadToSpace routes through the space-configured adapter', async () => {
    jest.mocked(bunnyStorage.isBunnyStorageConfigured).mockReturnValue(true);
    jest.mocked(bunnyStorage.uploadToBunnyStorage).mockResolvedValue('https://cdn.example.test/trainer-videos/clip.mp4');
    const result = await uploadToSpace('training-assets', { buffer: Buffer.from('v'), contentType: 'video/mp4', filename: 'clip.mp4' });
    expect(result.url).toBe('https://cdn.example.test/trainer-videos/clip.mp4');
    expect(result.space).toBe('training-assets');
  });
});

describe('local adapter (existing public/uploads fallback shape)', () => {
  it('getPublicUrl preserves the existing /uploads URL shape', () => {
    const adapter = new LocalStorageAdapter();
    // A space-backed public URL must keep the exact BACKEND_URL/uploads/... shape
    // that every existing DB row already stores.
    const url = adapter.getPublicUrl('public-images', 'images/a.webp');
    expect(url).toMatch(/\/uploads\/images\/a\.webp$/);
  });

  it('refuses private content on local disk (no access control there)', async () => {
    const adapter = new LocalStorageAdapter();
    expect(() => adapter.getPublicUrl('product-files', 'x.pdf')).toThrow(WrongSpaceVisibilityError);
    try { await adapter.getAuthorizedDownload('product-files', 'x.pdf'); throw new Error('should have thrown'); } catch (err) { expect(err).toBeInstanceOf(WrongSpaceVisibilityError); }
  });
});
