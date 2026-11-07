// ============================================================
// Children's Book — fonts the parent can pick for the book text. Every font
// here is open-licensed (SIL OFL 1.1, shipped through @fontsource) so it can
// be embedded in a PDF that the customer prints and sells on. Each choice
// pairs a Georgian face with a Latin one: a Georgian book still prints
// English names nicely and an English book can still show a Georgian word.
//
// The choice lives in BookProject.characterConfig.fontId (no migration) and
// changing it never touches an image, so it can be changed at any time; the
// stored PDF just becomes STALE and is rebuilt on the next "create PDF".
// The frontend has a matching list in
// Frontend/src/components/tools/childrensBook/bookFonts.ts.
// ============================================================

export interface BookFontFace {
  regular: string; // absolute path to a .woff file (pdf-lib/fontkit reads woff, not woff2)
  bold: string;
}

export interface BookFontChoice {
  georgian: BookFontFace;
  latin: BookFontFace;
}

function face(pkg: string, base: string): BookFontFace {
  return {
    regular: require.resolve(`@fontsource/${pkg}/files/${base}-400-normal.woff`),
    bold: require.resolve(`@fontsource/${pkg}/files/${base}-700-normal.woff`),
  };
}

const NOTO_SANS_GEORGIAN = face('noto-sans-georgian', 'noto-sans-georgian-georgian');
const NOTO_SANS_LATIN = face('noto-sans-georgian', 'noto-sans-georgian-latin');
const NOTO_SERIF_GEORGIAN = face('noto-serif-georgian', 'noto-serif-georgian-georgian');
// FiraGO's "latin" file is the whole font: it also covers Georgian.
const FIRAGO = face('firago', 'firago-latin');
const GOOGLE_SANS_GEORGIAN = face('google-sans', 'google-sans-georgian');
const GOOGLE_SANS_LATIN = face('google-sans', 'google-sans-latin');
const LITERATA = face('literata', 'literata-latin');
const PLAYPEN_SANS = face('playpen-sans', 'playpen-sans-latin');
const ANDIKA = face('andika', 'andika-latin');

export const BOOK_FONTS = {
  // Clean and plain; what every book used before the choice existed.
  SIMPLE: { georgian: NOTO_SANS_GEORGIAN, latin: NOTO_SANS_LATIN },
  // Soft, round and friendly.
  ROUNDED: { georgian: GOOGLE_SANS_GEORGIAN, latin: GOOGLE_SANS_LATIN },
  // Modern, very legible.
  MODERN: { georgian: FIRAGO, latin: FIRAGO },
  // Classic book serif, a fairy-tale feel.
  FAIRYTALE: { georgian: NOTO_SERIF_GEORGIAN, latin: LITERATA },
  // Hand-written look for English text (Georgian stays round).
  PLAYFUL: { georgian: GOOGLE_SANS_GEORGIAN, latin: PLAYPEN_SANS },
  // Andika is designed for children learning to read.
  EASY_READ: { georgian: NOTO_SANS_GEORGIAN, latin: ANDIKA },
} as const satisfies Record<string, BookFontChoice>;

export type BookFontId = keyof typeof BOOK_FONTS;
export const BOOK_FONT_IDS = Object.keys(BOOK_FONTS) as BookFontId[];
export const DEFAULT_BOOK_FONT: BookFontId = 'SIMPLE';

// Last resort for characters the chosen face lacks (a rare symbol, a
// Georgian letter missing from a Latin-only face, ...).
export const FALLBACK_BOOK_FONTS: BookFontFace[] = [NOTO_SANS_LATIN, NOTO_SANS_GEORGIAN];

export function isBookFontId(value: unknown): value is BookFontId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BOOK_FONTS, value);
}

export function resolveBookFont(value: unknown): BookFontId {
  return isBookFontId(value) ? value : DEFAULT_BOOK_FONT;
}
