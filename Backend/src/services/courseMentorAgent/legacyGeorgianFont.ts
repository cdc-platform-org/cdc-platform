/**
 * Course Mentor Agent — legacy Georgian font repair.
 * Exports: convertAcadNusxWord, looksLikeAcadNusxLine, repairLegacyGeorgianText.
 *
 * Many Georgian textbooks (pre-2015 PDFs) were typeset with "AcadNusx"-style
 * fonts that draw Georgian letters on top of Latin code points. Extracted
 * text then reads like "saqarTvelos teqnikuri universiteti" instead of
 * "საქართველოს ტექნიკური უნივერსიტეტი". This module converts such lines
 * back to Unicode Georgian, while leaving real English text and source code
 * (e.g. "MainCtrl", "ng-controller") untouched.
 */

// The standard AcadNusx keyboard layout: lowercase letters, plus the
// uppercase letters that carry their own Georgian character.
const ACADNUSX_MAP: Record<string, string> = {
  a: 'ა', b: 'ბ', g: 'გ', d: 'დ', e: 'ე', v: 'ვ', z: 'ზ', T: 'თ', i: 'ი', k: 'კ',
  l: 'ლ', m: 'მ', n: 'ნ', o: 'ო', p: 'პ', J: 'ჟ', r: 'რ', s: 'ს', t: 'ტ', u: 'უ',
  f: 'ფ', q: 'ქ', R: 'ღ', y: 'ყ', S: 'შ', C: 'ჩ', c: 'ც', Z: 'ძ', w: 'წ', W: 'ჭ',
  x: 'ხ', j: 'ჯ', h: 'ჰ',
};

export function convertAcadNusxWord(word: string): string {
  let out = '';
  for (const ch of word) out += ACADNUSX_MAP[ch] ?? ch;
  return out;
}

// Characters that only appear in code / markup — a line containing them is
// never converted, even if it happens to look Georgian-ish.
const CODE_CHARS = /[{}()<>=;$"'`\\/]|\w\.\w|=>/;

// Strong signal that a Latin word is really AcadNusx: an uppercase
// Georgian-only letter inside a lowercase word ("saqarTvelos",
// "RvinefaZe"), or "q" followed by anything but "u" ("teqnikuri") —
// spellings English practically never produces.
const STRONG_SIGNAL = /[a-z][TJRSCZW]|q[a-tv-z]/;
// Letter patterns that only English (or code identifiers) produce. One such
// word anywhere in the line keeps the whole line as it is, which protects
// identifiers like "productCode" next to English words in code listings.
const ENGLISH_LOOKING = /th|ck|ow|ee|oo|ph|wh|tion|sion|ing|igh|ble$|ss|ll|ff|pp|tt|er$|ed$|ly$|ment/i;
const COMMON_ENGLISH = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'for', 'on', 'with', 'as', 'by', 'it', 'or', 'an', 'be', 'this',
  'that', 'are', 'from', 'at', 'not', 'can', 'all', 'use', 'new', 'one', 'html', 'css', 'javascript',
  // code keywords that show up in listings
  'void', 'int', 'public', 'private', 'static', 'return', 'class', 'var', 'let', 'const', 'function', 'import',
]);

function isPlainLatinWord(word: string): boolean {
  if (!/^[A-Za-z]+$/.test(word)) return false;
  // CamelCase identifiers starting uppercase ("MainCtrl", "UserService")
  // are code: Georgian has no word-initial capitals except the mapped
  // letters themselves.
  if (/^[A-Z][a-z]+[A-Z]/.test(word) && !/^[TJRSCZW]/.test(word)) return false;
  // Accessor-style identifiers ("setSecure", "getName", "onClick").
  if (/^(get|set|is|has|on|to)[A-Z]/.test(word)) return false;
  // All-caps tokens (SVG, HTML, TXT) are acronyms.
  if (word.length > 1 && word === word.toUpperCase()) return false;
  return true;
}

// A line is converted only when: it has no code characters, at least two
// words, every word is plain Latin, no word looks English, and at least
// one word carries a strong AcadNusx signal. Single-word lines are skipped
// (too little evidence — "Count" and "Cij" are real English/code).
export function looksLikeAcadNusxLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || CODE_CHARS.test(trimmed)) return false;
  if (/[Ⴀ-ჿ]/.test(trimmed)) return false; // already Unicode Georgian
  const words = trimmed.split(/[\s,.:;!?«»„“”-]+/).filter(Boolean);
  if (words.length < 2) return false;
  if (!words.every(isPlainLatinWord)) return false;
  if (words.some((w) => COMMON_ENGLISH.has(w.toLowerCase()) || ENGLISH_LOOKING.test(w))) return false;
  return words.some((w) => STRONG_SIGNAL.test(w));
}

export function repairLegacyGeorgianText(text: string): { text: string; convertedLines: number } {
  let convertedLines = 0;
  const lines = text.split('\n').map((line) => {
    if (!looksLikeAcadNusxLine(line)) return line;
    convertedLines++;
    return line.replace(/[A-Za-z]+/g, convertAcadNusxWord);
  });
  return { text: lines.join('\n'), convertedLines };
}
