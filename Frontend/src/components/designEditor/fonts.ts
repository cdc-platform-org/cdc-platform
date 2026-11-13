// ============================================================
// Design editor fonts — maps the template font names (DESIGN_FONT_FAMILIES,
// validated server-side) to the self-hosted next/font faces declared in
// tools/childrensBook/bookFonts.ts, so Georgian renders identically on every
// device and in the exported PDF/PNG (the canvas draws with whatever font the
// browser has loaded — never a system font for Georgian).
// ============================================================
import {
  firaGo, notoSansGeorgian, notoSansLatin, notoSerifGeorgian, googleSansGeorgian, googleSansLatin, literata,
} from '../tools/childrensBook/bookFonts';
import type { DesignFontFamily } from '../../types/designTemplate';

const stack = (...families: string[]) => families.join(', ');

// Latin face first, then its Georgian partner — the browser picks per letter.
export const DESIGN_FONT_STACKS: Record<DesignFontFamily, string> = {
  FiraGO: stack(firaGo.style.fontFamily, 'sans-serif'),
  'Noto Sans Georgian': stack(notoSansLatin.style.fontFamily, notoSansGeorgian.style.fontFamily, 'sans-serif'),
  'Noto Serif Georgian': stack(literata.style.fontFamily, notoSerifGeorgian.style.fontFamily, 'serif'),
  'Google Sans': stack(googleSansLatin.style.fontFamily, googleSansGeorgian.style.fontFamily, 'sans-serif'),
  Literata: stack(literata.style.fontFamily, notoSerifGeorgian.style.fontFamily, 'serif'),
};

export const DESIGN_FONT_LABELS: Record<DesignFontFamily, string> = {
  FiraGO: 'FiraGO',
  'Noto Sans Georgian': 'Noto Sans',
  'Noto Serif Georgian': 'Noto Serif',
  'Google Sans': 'Google Sans',
  Literata: 'Literata',
};

export function fontStack(family: string): string {
  return DESIGN_FONT_STACKS[family as DesignFontFamily] ?? DESIGN_FONT_STACKS.FiraGO;
}

// Canvas text is drawn immediately; if the web font isn't loaded yet the
// browser silently uses a fallback and never redraws. So every face (both
// weights, Latin + Georgian sample text) is loaded before the first render.
let loading: Promise<void> | null = null;
export function ensureDesignFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  if (!loading) {
    const families = Object.values(DESIGN_FONT_STACKS);
    loading = Promise.all(
      families.flatMap((family) => [400, 700].flatMap((weight) => [
        document.fonts.load(`${weight} 24px ${family}`, 'Aaბგდ'),
        document.fonts.load(`italic ${weight} 24px ${family}`, 'Aaბგდ'),
      ])),
    ).then(() => undefined, () => undefined);
  }
  return loading;
}
