import sharp from 'sharp';
import { readBookAsset } from './bookStorageService';

// ============================================================
// Children's Book — the optional extras a parent can add on top of the
// character's name/age/traits:
//   - `appearance`: free-text visual description (hair, eyes, clothes...)
//   - a photo of the child (stored privately, EXIF stripped, used only as a
//     reference image for the character portrait)
//   - `extraCharacters`: other people/animals to include in the story
// All three are optional and live inside BookProject.characterConfig (JSON),
// then get copied into the locked characterBible at approval time.
// ============================================================

export const MAX_APPEARANCE_LENGTH = 500;
export const MAX_EXTRA_CHARACTERS_LENGTH = 500;
export const MAX_CHARACTER_PHOTO_BYTES = 8 * 1024 * 1024;
export const ALLOWED_CHARACTER_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Normalized photo size: big enough for the image model to read a face,
// small enough to keep storage and the edit request light.
const PHOTO_MAX_EDGE = 1024;

export interface CharacterExtras {
  appearance?: string;
  extraCharacters?: string;
  photoKey?: string;
  photoMimeType?: string;
}

export type ExtrasValidation = { ok: true; value: { appearance?: string; extraCharacters?: string } } | { ok: false; message: string };

// Validates the two free-text fields from a request body. Empty strings are
// treated as "not provided" so the parent can clear a field.
export function validateCharacterExtras(input: { appearance?: unknown; extraCharacters?: unknown }): ExtrasValidation {
  const value: { appearance?: string; extraCharacters?: string } = {};
  if (input.appearance !== undefined && input.appearance !== null) {
    if (typeof input.appearance !== 'string') return { ok: false, message: 'character.appearance must be text.' };
    const trimmed = input.appearance.trim();
    if (trimmed.length > MAX_APPEARANCE_LENGTH) return { ok: false, message: `character.appearance must be at most ${MAX_APPEARANCE_LENGTH} characters.` };
    if (trimmed) value.appearance = trimmed;
  }
  if (input.extraCharacters !== undefined && input.extraCharacters !== null) {
    if (typeof input.extraCharacters !== 'string') return { ok: false, message: 'character.extraCharacters must be text.' };
    const trimmed = input.extraCharacters.trim();
    if (trimmed.length > MAX_EXTRA_CHARACTERS_LENGTH) return { ok: false, message: `character.extraCharacters must be at most ${MAX_EXTRA_CHARACTERS_LENGTH} characters.` };
    if (trimmed) value.extraCharacters = trimmed;
  }
  return { ok: true, value };
}

// Prompt fragments shared by the character preview, final pages and
// revisions. User text is quoted and flattened to one line so it can't
// break the surrounding prompt structure.
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/"/g, "'").trim();
}

export function appearancePromptLine(extras: CharacterExtras | null | undefined): string {
  return extras?.appearance ? `Main character appearance: "${flatten(extras.appearance)}".` : '';
}

export function extraCharactersPromptLine(extras: CharacterExtras | null | undefined): string {
  return extras?.extraCharacters ? `Supporting characters who may appear in the story: "${flatten(extras.extraCharacters)}".` : '';
}

export function photoReferencePromptLine(): string {
  return 'Use the reference photo only to match the main character\'s face, hair, skin tone and overall look; redraw them fully as a storybook illustration, never photorealistic.';
}

// Re-encodes an uploaded photo: honours EXIF orientation, strips all
// metadata (GPS etc. — this is a photo of a child), and caps the size.
// Throws on anything sharp can't decode, so a renamed non-image is refused.
export async function normalizeCharacterPhoto(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' }> {
  const out = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { buffer: out, mimeType: 'image/jpeg' };
}

// Loads a stored image to pass as a reference to the image model. Returns
// an empty list if the key is missing or unreadable, so generation falls
// back to text-only instead of failing.
export async function loadReferenceImage(key: string | undefined | null, mimeType: string | undefined | null): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
  if (!key) return [];
  try {
    return [{ buffer: await readBookAsset(key), mimeType: mimeType || 'image/png' }];
  } catch {
    return [];
  }
}

// The approved character portrait is the reference for every page of every
// book (not only books with a parent photo): without it each page was drawn
// from text alone, so the child's clothes and look changed from page to page.
export async function loadCharacterReference(characterBible: { previewImageKey?: string | null; previewImageMimeType?: string | null } | null | undefined): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
  return loadReferenceImage(characterBible?.previewImageKey, characterBible?.previewImageMimeType);
}

export function consistencyPromptLine(hasReference: boolean): string {
  return hasReference
    ? 'The main character must look exactly like the reference portrait on every page: same face, hairstyle, outfit, clothing colours and accessories. Do not change their clothes between pages; only pose and expression change with the scene.'
    : 'The main character wears the same outfit, colours and hairstyle on every page; do not change their clothes between pages.';
}