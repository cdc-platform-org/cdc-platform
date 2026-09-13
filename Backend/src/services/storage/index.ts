import { StorageAdapter, StorageProvider, StorageSpace, UploadInput, UploadObject } from './types';
import { getSpaceConfig } from './config';
import { BunnyStorageAdapter } from './bunnyAdapter';
import { AzureBlobAdapter } from './azureBlobAdapter';
import { LocalStorageAdapter } from './localAdapter';

// ============================================================
// Storage facade — the ONLY module feature code should import from
// this directory.
//
// Usage:
//   import { getStorage } from '../services/storage';
//   const stored = await getStorage('public-images').upload('public-images', {...});
//
// The adapter is resolved per-space from config.ts's SPACES map, so a
// space's provider can change in one place without touching callers.
// Phase A: every space resolves to the provider it already uses today
// (Bunny for public images/videos, Azure blob for private files) —
// zero behavioral change.
// ============================================================

const bunny = new BunnyStorageAdapter();
const azure = new AzureBlobAdapter();
const local = new LocalStorageAdapter();

export function getAdapterForProvider(provider: StorageProvider): StorageAdapter {
  switch (provider) {
    case 'bunny': return bunny;
    case 'azure-blob': return azure;
    case 'local': return local;
  }
}

// Resolves the adapter configured for the given space.
export function getStorage(space: StorageSpace): StorageAdapter {
  return getAdapterForProvider(getSpaceConfig(space).provider);
}

// Convenience for features that just upload and persist the URL.
export async function uploadToSpace(space: StorageSpace, input: UploadInput): Promise<UploadObject> {
  return getStorage(space).upload(space, input);
}

export type { StorageAdapter, StorageSpace, StorageProvider, UploadInput, UploadObject } from './types';
