import crypto from 'crypto';

// Per-student shuffling for the AI Proctored Exam (ExamSession /
// ExamSubmission). Every student who opens the same exam link gets the same
// questions, but in a different order and with the A-D options in a
// different order, so neighbours sitting side by side can't copy answer
// letters from each other's screens.
//
// The permutation is derived deterministically from the submission's own
// opaque candidateToken (plus the question id), so nothing new has to be
// stored: the /start and /resume routes rebuild exactly the same layout,
// and /submit maps the letters the student clicked back to the stored
// (canonical) letters before grading. Stored answers and teacher reports
// therefore always use the canonical letters from ExamQuestion.options.

const LETTERS = ['A', 'B', 'C', 'D'] as const;
export type OptionLetter = (typeof LETTERS)[number];
export type OptionMap = Record<OptionLetter, string>;

// Small seeded PRNG (mulberry32) fed from a SHA-256 of the seed string —
// plenty for shuffling 4 options / a few dozen questions, and stable across
// Node versions (unlike relying on Math.random or object key order).
function seededRandom(seed: string): () => number {
  let state = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// displayed letter (index i) shows the canonical option perm[i].
function optionPermutation(submissionToken: string, questionId: string): OptionLetter[] {
  return shuffle(LETTERS, `opts:${submissionToken}:${questionId}`);
}

export function isOptionMap(value: unknown): value is OptionMap {
  if (!value || typeof value !== 'object') return false;
  return LETTERS.every((l) => typeof (value as Record<string, unknown>)[l] === 'string');
}

export interface ShufflableQuestion {
  id: string;
  type: string;
  options: unknown;
}

// Returns the questions in this student's personal order with their MCQ
// options re-lettered. Multiple-choice questions are shuffled among
// themselves; open (PRACTICAL/CODE) questions stay at the end, in their
// original order, since they're the long-form part of the exam.
export function shuffleQuestionsForSubmission<Q extends ShufflableQuestion>(questions: Q[], submissionToken: string): Q[] {
  const mcq = questions.filter((q) => q.type === 'MCQ');
  const open = questions.filter((q) => q.type !== 'MCQ');
  const orderedMcq = shuffle(mcq, `order:${submissionToken}`);
  return [...orderedMcq, ...open].map((q) => {
    if (q.type !== 'MCQ' || !isOptionMap(q.options)) return q;
    const canonical = q.options;
    const perm = optionPermutation(submissionToken, q.id);
    const displayed = {} as OptionMap;
    LETTERS.forEach((letter, i) => {
      displayed[letter] = canonical[perm[i]];
    });
    return { ...q, options: displayed };
  });
}

// Maps the letter a student clicked (in their shuffled layout) back to the
// canonical letter stored on ExamQuestion. Anything that isn't A-D is
// returned unchanged (empty / tampered values simply won't match the key).
export function displayedToCanonicalLetter(submissionToken: string, questionId: string, displayed: string): string {
  const idx = LETTERS.indexOf(displayed as OptionLetter);
  if (idx === -1) return displayed;
  return optionPermutation(submissionToken, questionId)[idx];
}

// Inverse of displayedToCanonicalLetter: which letter this student saw for
// a canonical option. Used to show results in the student's own layout.
export function canonicalToDisplayedLetter(submissionToken: string, questionId: string, canonical: string): string {
  const idx = optionPermutation(submissionToken, questionId).indexOf(canonical as OptionLetter);
  return idx === -1 ? canonical : LETTERS[idx];
}
