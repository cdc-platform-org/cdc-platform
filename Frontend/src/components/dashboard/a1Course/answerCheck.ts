// Deterministic answer checking for the A1 step-by-step course.
//
// A1 learners make small, predictable mistakes (lower-case "i", a missing
// "am", a one-letter typo). Checking locally, with no AI call, keeps the
// feedback instant and free and lets each mistake get a concrete
// correction: which word was missing, which word was extra, and the full
// correct sentence.

// The placeholder used in curriculum strings for the learner's own name.
export const NAME_SLOT = '{name}';

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bthat's\b/g, 'that is'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bcan't\b/g, 'cannot'],
  // Missing apostrophes are a spelling slip, not a grammar mistake.
  [/\bim\b/g, 'i am'],
  [/\bdont\b/g, 'do not'],
  [/\bdoesnt\b/g, 'does not'],
  [/\bisnt\b/g, 'is not'],
  [/\bcant\b/g, 'cannot'],
];

export function normalize(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.,!?;:"“”()]/g, ' ');
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type CheckStatus = 'correct' | 'typo' | 'wrong';

export interface CheckResult {
  status: CheckStatus;
  // The accepted answer closest to what the learner wrote, with the name
  // slot filled in, for display.
  expected: string;
  // Words the learner left out / added, relative to `expected`.
  missing: string[];
  extra: string[];
  // True when the learner wrote a lone lower-case "i" (always "I" in English).
  lowercaseI: boolean;
}

// A name slot accepts any single word, so a learner who types their name
// with a different spelling (or in their own script) is never marked wrong.
function alignName(expected: string[], input: string[]): string[] {
  const slot = NAME_SLOT.toLowerCase();
  if (!expected.includes(slot)) return expected;
  const known = new Set(expected.filter((t) => t !== slot));
  // The learner's name is the word they wrote that isn't part of the
  // sentence itself; fall back to the same position.
  const unknown = input.filter((t) => !known.has(t));
  // A name at the end of the sentence ("I am Giorgi") is the learner's
  // last unfamiliar word, so "I amm Giorgi" still finds "giorgi".
  const slotIsLast = expected[expected.length - 1] === slot;
  const candidate = slotIsLast ? unknown[unknown.length - 1] : unknown[0];
  return expected.map((tok, i) => (tok === slot ? candidate ?? input[i] ?? tok : tok));
}

function diffWords(expected: string[], input: string[]): { missing: string[]; extra: string[] } {
  const remaining = [...input];
  const missing: string[] = [];
  for (const w of expected) {
    const idx = remaining.indexOf(w);
    if (idx >= 0) remaining.splice(idx, 1);
    else missing.push(w);
  }
  return { missing, extra: remaining };
}

export function fillName(text: string, name: string): string {
  return text.split(NAME_SLOT).join(name);
}

/**
 * @param input    what the learner typed / built / said
 * @param answers  accepted answers (may contain {name})
 * @param name     the learner's name, used only for display of `expected`
 * @param lenient  speech recognition mode: allows more character slack
 * @param allowTypos false for word-tile answers, where there is no spelling
 *                 to slip on and "apple" vs "apples" is a real mistake
 */
export function checkAnswer(input: string, answers: string[], name: string, lenient = false, allowTypos = true): CheckResult {
  const inputTokens = tokens(input);
  const lowercaseI = /(^|\s)i(\s|'|$)/.test(input.replace(/[’‘]/g, "'"));
  let best: { score: number; expectedTokens: string[]; answer: string } | null = null;

  for (const answer of answers) {
    const expectedTokens = alignName(tokens(answer), inputTokens);
    const score = levenshtein(expectedTokens.join(' '), inputTokens.join(' '));
    if (!best || score < best.score) best = { score, expectedTokens, answer };
  }
  if (!best) return { status: 'wrong', expected: '', missing: [], extra: [], lowercaseI };

  const expectedDisplay = fillName(best.answer, name);
  const { missing, extra } = diffWords(best.expectedTokens, inputTokens);

  if (best.score === 0) return { status: 'correct', expected: expectedDisplay, missing: [], extra: [], lowercaseI };

  const len = best.expectedTokens.join(' ').length;
  const allowed = lenient ? Math.max(2, Math.floor(len / 5)) : Math.max(1, Math.floor(len / 9));
  // A typo is a small slip inside the right words — never a missing or
  // extra word ("I Giorgi" vs "I am Giorgi" is a real grammar mistake).
  const sameWordCount = best.expectedTokens.length === inputTokens.length;
  if (allowTypos && best.score <= allowed && (sameWordCount || lenient)) {
    return { status: 'typo', expected: expectedDisplay, missing, extra, lowercaseI };
  }
  return { status: 'wrong', expected: expectedDisplay, missing, extra, lowercaseI };
}

// ---- Learner name ----

const KA_TO_LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o',
  პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts',
  ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Best-effort Latin first name for English exercises ("გიორგი" → "Giorgi"). */
export function latinFirstName(raw: string | null | undefined): string {
  const first = (raw ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return '';
  if (/^[A-Za-z][A-Za-z'-]*$/.test(first)) return capitalize(first.toLowerCase());
  if (/^[ა-ჿ]+$/.test(first)) {
    return capitalize(
      Array.from(first)
        .map((ch) => KA_TO_LATIN[ch] ?? '')
        .join('')
    );
  }
  return '';
}
