import { StorageProvider, StorageSpace, StorageVisibility } from './types';

// ============================================================
// Logical space → provider/visibility mapping — the ONE place that
// knows where anything lives.
//
// Phase A pins every space to its CURRENT provider so behavior is
// unchanged. Phase B/C flips individual spaces here (e.g. 'public-images'
// → 'azure-blob') without touching feature code.
//
// Visibility rule enforced by adapters: public spaces serve stable
// public URLs; private spaces serve short-lived signed URLs. A space
// is never both.
// ============================================================

export interface SpaceConfig {
  provider: StorageProvider;
  visibility: StorageVisibility;
  // Provider-specific sub-locators (Bunny folder, local subdirectory).
  // Phase A mirrors the folder names features already use today so URLs
  // stay identical. Azure containers arrive in Phase B.
  defaultFolder?: string;
}

export const SPACES: Record<StorageSpace, SpaceConfig> = {
  'public-images': { provider: 'bunny', visibility: { public: true }, defaultFolder: 'images' },
  'product-files': { provider: 'azure-blob', visibility: { public: false } },
  'product-videos': { provider: 'bunny', visibility: { public: true }, defaultFolder: 'product-videos' },
  'training-assets': { provider: 'bunny', visibility: { public: true }, defaultFolder: 'trainer-videos' },
  'private-media': { provider: 'azure-blob', visibility: { public: false } },
  'generated-assets': { provider: 'azure-blob', visibility: { public: false } },
};

export function getSpaceConfig(space: StorageSpace): SpaceConfig {
  return SPACES[space];
}

export function isPublicSpace(space: StorageSpace): boolean {
  return SPACES[space].visibility.public;
}

// Optional env-level override — Phase A deliberately does NOT read this
// (defaults keep current behavior), it exists only so Phase C can flip
// reads/writes per-space without further code changes. Names only; no
// secret values are stored here.
export const STORAGE_PROVIDER_ENV_KEYS = {
  write: 'STORAGE_WRITE_PROVIDER',
  read: 'STORAGE_READ_PROVIDER',
} as const;
