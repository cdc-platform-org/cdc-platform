import localFont from 'next/font/local';

// ============================================================
// Children's Book fonts — the same six choices as the server's
// Backend/src/services/bookFonts.ts (keep the ids in sync). All are open-
// licensed (SIL OFL) and self-hosted from @fontsource through next/font, so
// nothing loads from a third-party CDN. preload is off: a font file is only
// downloaded when a page actually shows text in it.
//
// Each choice is a Latin face followed by a Georgian one; the browser draws
// every letter with the first face that has it, exactly like the PDF does.
// ============================================================

const notoSansGeorgian = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const notoSansLatin = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/noto-sans-georgian/files/noto-sans-georgian-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const notoSerifGeorgian = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/noto-serif-georgian/files/noto-serif-georgian-georgian-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/noto-serif-georgian/files/noto-serif-georgian-georgian-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
// FiraGO's "latin" file is the whole font, Georgian included.
const firaGo = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/firago/files/firago-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/firago/files/firago-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const googleSansGeorgian = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/google-sans/files/google-sans-georgian-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/google-sans/files/google-sans-georgian-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const googleSansLatin = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/google-sans/files/google-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/google-sans/files/google-sans-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const literata = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/literata/files/literata-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/literata/files/literata-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const playpenSans = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/playpen-sans/files/playpen-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/playpen-sans/files/playpen-sans-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});
const andika = localFont({
  src: [
    { path: '../../../../node_modules/@fontsource/andika/files/andika-latin-400-normal.woff2', weight: '400' },
    { path: '../../../../node_modules/@fontsource/andika/files/andika-latin-700-normal.woff2', weight: '700' },
  ],
  preload: false,
  display: 'swap',
  // No metric-matched Arial fallback: Arial would sit between a Latin-only
  // face and its Georgian partner in the stack and could draw the Georgian.
  adjustFontFallback: false,
});

const stack = (...families: string[]) => families.join(', ');

export const BOOK_FONT_IDS = ['SIMPLE', 'ROUNDED', 'MODERN', 'FAIRYTALE', 'PLAYFUL', 'EASY_READ'] as const;
export type BookFontId = (typeof BOOK_FONT_IDS)[number];
export const DEFAULT_BOOK_FONT: BookFontId = 'SIMPLE';

export const BOOK_FONT_FAMILIES: Record<BookFontId, string> = {
  SIMPLE: stack(notoSansLatin.style.fontFamily, notoSansGeorgian.style.fontFamily, 'sans-serif'),
  ROUNDED: stack(googleSansLatin.style.fontFamily, googleSansGeorgian.style.fontFamily, 'sans-serif'),
  MODERN: stack(firaGo.style.fontFamily, 'sans-serif'),
  FAIRYTALE: stack(literata.style.fontFamily, notoSerifGeorgian.style.fontFamily, 'serif'),
  PLAYFUL: stack(playpenSans.style.fontFamily, googleSansGeorgian.style.fontFamily, 'sans-serif'),
  EASY_READ: stack(andika.style.fontFamily, notoSansGeorgian.style.fontFamily, 'sans-serif'),
};

// For a Georgian book, PLAYFUL and EASY_READ only change the English
// letters (no open-licensed hand-written / reading-primer Georgian face
// exists), so the Georgian picker lists the four that look different.
export function bookFontOptions(language: 'KA' | 'EN' | string): BookFontId[] {
  return language === 'KA' ? ['SIMPLE', 'ROUNDED', 'MODERN', 'FAIRYTALE'] : [...BOOK_FONT_IDS];
}

export function isBookFontId(value: unknown): value is BookFontId {
  return typeof value === 'string' && (BOOK_FONT_IDS as readonly string[]).includes(value);
}

export function bookFontFamily(fontId: unknown): string {
  return BOOK_FONT_FAMILIES[isBookFontId(fontId) ? fontId : DEFAULT_BOOK_FONT];
}
