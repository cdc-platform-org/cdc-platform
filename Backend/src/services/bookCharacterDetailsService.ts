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
// ============================================================
// Siblings — up to MAX_SIBLINGS brothers/sisters who star in the same story
// next to the main character. Each has a name and optional age, appearance
// text and photo (photo fields are server-owned, set only by the upload
// route). The character portrait becomes a group portrait of all of them,
// and that approved portrait is the reference for every page, so the
// siblings look the same throughout the book.
// ============================================================

export const MAX_SIBLINGS = 3;
export const MAX_SIBLING_NAME_LENGTH = 60;

export interface SiblingInput {
  name: string;
  age?: number;
  appearance?: string;
}

export interface SiblingConfig extends SiblingInput {
  photoKey?: string;
  photoMimeType?: string;
  photoConsentAt?: string;
}

export type SiblingsValidation = { ok: true; value: SiblingInput[] } | { ok: false; message: string };

export function validateSiblings(raw: unknown): SiblingsValidation {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, message: 'character.siblings must be a list.' };
  const value: SiblingInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return { ok: false, message: 'Each sibling must be an object.' };
    const name = typeof (entry as any).name === 'string' ? (entry as any).name.trim() : '';
    // Rows the parent left empty are simply skipped.
    if (!name) continue;
    if (name.length > MAX_SIBLING_NAME_LENGTH) return { ok: false, message: `A sibling's name must be at most ${MAX_SIBLING_NAME_LENGTH} characters.` };
    const sibling: SiblingInput = { name };
    const age = (entry as any).age;
    if (typeof age === 'number' && Number.isFinite(age) && age >= 0 && age <= 25) sibling.age = Math.round(age);
    const appearance = (entry as any).appearance;
    if (appearance !== undefined && appearance !== null) {
      if (typeof appearance !== 'string') return { ok: false, message: "A sibling's appearance must be text." };
      const trimmed = appearance.trim();
      if (trimmed.length > MAX_APPEARANCE_LENGTH) return { ok: false, message: `A sibling's appearance must be at most ${MAX_APPEARANCE_LENGTH} characters.` };
      if (trimmed) sibling.appearance = trimmed;
    }
    value.push(sibling);
  }
  if (value.length > MAX_SIBLINGS) return { ok: false, message: `At most ${MAX_SIBLINGS} siblings can be added.` };
  return { ok: true, value };
}

function describeSibling(s: SiblingInput): string {
  return `${flatten(s.name)}${s.age !== undefined ? ` (age ${s.age})` : ''}${s.appearance ? `: ${flatten(s.appearance)}` : ''}`;
}

// Image prompts (preview, final pages, revisions).
export function siblingsPromptLine(config: { siblings?: SiblingInput[] } | null | undefined): string {
  const siblings = config?.siblings ?? [];
  if (!siblings.length) return '';
  return `The main character's siblings appear together with them: "${siblings.map(describeSibling).join('; ')}". Keep every sibling recognisably the same on every page, as in the reference portrait.`;
}

// Story text prompt.
export function siblingsStoryLine(config: { siblings?: SiblingInput[] } | null | undefined): string {
  const siblings = config?.siblings ?? [];
  if (!siblings.length) return '';
  return `Siblings who go on the whole adventure together with the main character (give each of them something to do): ${siblings.map(describeSibling).join('; ')}.`;
}

// Character preview: one group portrait of the main character and siblings,
// plus which reference photo belongs to whom.
export function groupPortraitPromptLine(mainName: string, mainHasPhoto: boolean, siblings: SiblingConfig[]): string {
  if (!siblings.length) return '';
  const order: string[] = [];
  if (mainHasPhoto) order.push(mainName);
  for (const s of siblings) if (s.photoKey) order.push(s.name);
  return [
    `Draw a group character sheet: ${flatten(mainName)} together with their siblings ${siblings.map((s) => flatten(s.name)).join(', ')}, standing side by side, full body, each child clearly distinct.`,
    order.length ? `Reference photos are given in this order: ${order.map((n, i) => `${i + 1}) ${flatten(n)}`).join(', ')}. Use each photo only to match that child's face, hair and skin tone, redrawn as a storybook illustration, never photorealistic.` : '',
  ].filter(Boolean).join(' ');
}
