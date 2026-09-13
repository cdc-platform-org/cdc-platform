import {
  uploadToBunnyStorage,
  deleteFromBunnyStorage,
  deleteBunnyStorageUrlIfManaged,
  isBunnyStorageConfigured,
  BunnyStorageUploadError,
} from '../bunnyStorage';
import { BUNNY_CDN_URL, BACKEND_URL } from '../../utils/env';
import { StorageAdapter, StorageSpace, UploadInput, UploadObject, AuthorizedDownload, StorageNotConfiguredError, StorageUploadError, WrongSpaceVisibilityError } from './types';
import { getSpaceConfig, isPublicSpace } from './config';

// ============================================================
// Bunny Storage adapter — wraps the EXISTING bunnyStorage.ts service
// verbatim. Phase A adds no new Bunny behavior; it only gives feature
// code a space-based vocabulary over it.
//
// URL ownership checks mirror deleteBunnyStorageUrlIfManaged's "only
// touch what we own" guard — a local /uploads URL or any external URL
// is never treated as managed by this adapter.
// ============================================================

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export class BunnyStorageAdapter implements StorageAdapter {
  readonly provider = 'bunny' as const;

  private assertConfigured(): void {
    if (!isBunnyStorageConfigured()) throw new StorageNotConfiguredError('bunny');
  }

  async upload(space: StorageSpace, input: UploadInput): Promise<UploadObject> {
    this.assertConfigured();
    const folder = sanitizePathSegment(input.folder ?? getSpaceConfig(space).defaultFolder ?? 'images');
    try {
      const url = await uploadToBunnyStorage({ buffer: input.buffer, mimetype: input.contentType, folderName: folder, filename: input.filename });
      return { key: `${folder}/${input.filename}`, url, provider: this.provider, space };
    } catch (err) {
      if (err instanceof BunnyStorageUploadError) throw new StorageUploadError('bunny', err.message);
      throw err;
    }
  }

  async delete(_space: StorageSpace, key: string): Promise<void> {
    this.assertConfigured();
    const [folder, filename] = key.split('/');
    if (!folder || !filename) return;
    await deleteFromBunnyStorage(folder, filename);
  }

  async deleteIfManaged(_space: StorageSpace, url: string | null | undefined): Promise<void> {
    // Delegates to the existing ownership-guarded delete — no-ops for
    // anything that isn't one of our Bunny CDN URLs.
    await deleteBunnyStorageUrlIfManaged(url);
  }

  getPublicUrl(_space: StorageSpace, key: string): string {
    if (!isPublicSpace(_space)) throw new WrongSpaceVisibilityError(_space, 'getPublicUrl');
    const base = BUNNY_CDN_URL.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  async getAuthorizedDownload(_space: StorageSpace, _key: string, _expiryMinutes?: number): Promise<AuthorizedDownload> {
    // Bunny CDN URLs are permanently public — there is nothing to sign.
    // Callers wanting expiring links for sensitive content must use the
    // azure-blob adapter.
    throw new WrongSpaceVisibilityError(_space, 'getAuthorizedDownload');
  }

  async exists(_space: StorageSpace, key: string): Promise<boolean> {
    // The existing Bunny service exposes no HEAD/exists call. Rather than
    // adding provider behavior in Phase A, exists() degrades to a URL-shape
    // check: a managed URL is assumed live. Callers needing a hard answer
    // (upload.ts) stay on the azure-blob adapter for now.
    return this.urlIsManaged(_space, this.getPublicUrl(_space, key));
  }

  urlIsManaged(_space: StorageSpace, url: string | null | undefined): boolean {
    if (!url || !isBunnyStorageConfigured()) return false;
    // Managed = a Bunny CDN URL of ours, or the legacy local /uploads URL
    // (which imageStorage still serves today when Bunny is unset).
    const cdnBase = BUNNY_CDN_URL.replace(/\/$/, '');
    return url.startsWith(`${cdnBase}/`) || url.startsWith(`${BACKEND_URL}/uploads/`);
  }
}
