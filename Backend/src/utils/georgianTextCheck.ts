// Detects "garbled" Georgian in AI-generated text.
//
// The language model occasionally emits a stray character from another
// script in the middle of a Georgian word (seen in a classroom test on
// 2026-11-10: the option "დაუნომრავ სიას" came out with two foreign glyphs in
// place of "რა", which students saw as hieroglyphs). The browser renders
// exactly what is stored, so the fix has to happen on the text itself.
//
// A word is flagged when it contains modern Georgian letters (Mkhedruli
// ა-ჰ) AND a letter from a script that never appears inside a modern
// Georgian word: Cyrillic, Greek, Armenian, CJK, archaic or capital
// (Mtavruli/Asomtavruli/Nuskhuri) Georgian, or the U+FFFD replacement
// character. Latin letters and digits are allowed, since technical terms
// such as "HTML-ის" or "<ul>-ს" are normal.

const MODERN_GEORGIAN = /[ა-ჰ]/u;
// Characters that should never sit inside a modern Georgian word.
const FOREIGN_IN_GEORGIAN_WORD =
  /[�Ⴀ-჏ჱ-ჿᲐ-Ჿⴀ-⴯Ͱ-ϿЀ-ԯ԰-֏　-鿿가-힯-]/u;

export function findGarbledGeorgianWords(text: string | null | undefined): string[] {
  if (!text) return [];
  const bad: string[] = [];
  for (const word of text.split(/[\s.,;:!?()"'«»„“”<>/\\[\]{}=+*|-]+/u)) {
    if (!word) continue;
    if (word.includes('�')) {
      bad.push(word);
      continue;
    }
    if (MODERN_GEORGIAN.test(word) && FOREIGN_IN_GEORGIAN_WORD.test(word)) bad.push(word);
  }
  return bad;
}

export function hasGarbledGeorgian(text: string | null | undefined): boolean {
  return findGarbledGeorgianWords(text).length > 0;
}

// Prompt rule appended to every exam prompt that may produce Georgian.
export const GEORGIAN_SCRIPT_RULE =
  'If you write in Georgian, use only the standard modern Georgian alphabet (ა-ჰ). Never put letters from other alphabets (Cyrillic, Armenian, Greek, old Georgian capitals) or unusual symbols inside a Georgian word, and double-check the spelling of every Georgian word.';
