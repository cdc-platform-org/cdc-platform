import {
  uploadPrivateBlob,
  getSignedBlobUrl,
  privateBlobExists,
} from '../privateBlobStorage';
import { StorageAdapter, StorageSpace, UploadInput, UploadObject, AuthorizedDownload, StorageNotConfiguredError, StorageUploadError, WrongSpaceVisibilityError } from './types';
import { getSpaceConfig, isPublicSpace } from './config';

// ============================================================
// Azure Blob adapter — wraps the EXISTING privateBlobStorage.ts service.
// Same delegation-key/SAS machinery, no new Azure behavior in Phase A.
//
// Product files keep the `cdcblob://<blobName>` marker convention from
// productFileDelivery.ts: feature code stores the marker, and a
// short-lived SAS URL is minted on demand. The adapter is marker-aware
// so future features can adopt the same pattern without inventing
// another scheme.
// ============================================================

export const PRODUCT_FILE_MARKER_SCHEME = 'cdcblob://';

function isAzureConfigured(): boolean {
  // env.ts requireEnv()s both at import time, so reaching here means
  // they're set; the explicit check keeps the failure mode readable if
  // that ever changes.
  return !!process.env.AZURE_STORAGE_ACCOUNT_URL && !!process.env.AZURE_STORAGE_CONTAINER_NAME;
}

export class AzureBlobAdapter implements StorageAdapter {
  readonly provider = 'azure-blob' as const;

  private assertConfigured(): void {
    if (!isAzureConfigured()) throw new StorageNotConfiguredError('azure-blob');
  }

  async upload(space: StorageSpace, input: UploadInput): Promise<UploadObject> {
    this.assertConfigured();
    const prefix = getSpaceConfig(space).defaultFolder ? `${getSpaceConfig(space).defaultFolder!}/` : '';
    const key = `${prefix}${input.folder ? `${input.folder}/` : ''}${input.filename}`;
    try {
      await uploadPrivateBlob(key, input.buffer, input.contentType);
    } catch (err) {
      throw new StorageUploadError('azure-blob', err instanceof Error ? err.message : 'upload failed');
    }
    // Private space — the persisted value is the cdcblob:// marker, NOT a
    // signed URL (which would expire). Signed URLs are minted on demand.
    return { key, url: `${PRODUCT_FILE_MARKER_SCHEME}${key}`, provider: this.provider, space };
  }

  async delete(_space: StorageSpace, key: string): Promise<void> {
    this.assertConfigured();
    // Intentionally not implemented in Phase A: no current Azure-caller
    // deletes blobs (product file delivery only mints URLs). Adding a
    // delete here would introduce a new provider operation — deferred to
    // the phase that actually needs it.
    void key;
  }

  async deleteIfManaged(_space: StorageSpace, url: string | null | undefined): Promise<void> {
    // Phase A: markers are never deleted through the abstraction yet
    // (no existing behavior deletes them either). Guarded no-op keeps the
    // interface complete without new provider operations.
    void url;
  }

  getPublicUrl(space: StorageSpace, _key: string): string {
    // Azure-blob-backed spaces are private in this architecture.
    throw new WrongSpaceVisibilityError(space, 'getPublicUrl');
  }

  async getAuthorizedDownload(space: StorageSpace, key: string, expiryMinutes = 15): Promise<AuthorizedDownload> {
    if (isPublicSpace(space)) throw new WrongSpaceVisibilityError(space, 'getAuthorizedDownload');
    this.assertConfigured();
    const url = await getSignedBlobUrl(key, expiryMinutes);
    return { url, expiresInMinutes: expiryMinutes };
  }

  async exists(_space: StorageSpace, key: string): Promise<boolean> {
    this.assertConfigured();
    return privateBlobExists(key);
  }

  urlIsManaged(_space: StorageSpace, url: string | null | undefined): boolean {
    return !!url && url.startsWith(PRODUCT_FILE_MARKER_SCHEME);
  }
}
