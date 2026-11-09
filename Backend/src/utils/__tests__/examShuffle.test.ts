import { shuffleQuestionsForSubmission, displayedToCanonicalLetter, canonicalToDisplayedLetter } from '../examShuffle';

const questions = Array.from({ length: 15 }, (_, i) => ({
  id: `q${i}`,
  order: i,
  type: 'MCQ',
  question: `Question ${i}`,
  options: { A: `q${i}-a`, B: `q${i}-b`, C: `q${i}-c`, D: `q${i}-d` },
}));
const withOpen = [...questions, { id: 'open', order: 15, type: 'PRACTICAL', question: 'Explain', options: null }];

describe('examShuffle', () => {
  it('is deterministic for the same submission token (resume shows the same layout)', () => {
    expect(shuffleQuestionsForSubmission(withOpen, 'tok-1')).toEqual(shuffleQuestionsForSubmission(withOpen, 'tok-1'));
  });

  it('gives different students a different question order', () => {
    const a = shuffleQuestionsForSubmission(withOpen, 'student-a').map((q) => q.id);
    const b = shuffleQuestionsForSubmission(withOpen, 'student-b').map((q) => q.id);
    expect(a).not.toEqual(b);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('keeps open questions at the end and never loses or duplicates options', () => {
    const shuffled = shuffleQuestionsForSubmission(withOpen, 'tok-2');
    expect(shuffled[shuffled.length - 1].id).toBe('open');
    for (const q of shuffled.filter((x) => x.type === 'MCQ')) {
      const original = questions.find((o) => o.id === q.id)!;
      expect(Object.values(q.options as object).sort()).toEqual(Object.values(original.options).sort());
    }
  });

  it('maps every displayed letter back to the canonical letter holding the same text', () => {
    for (const token of ['t1', 't2', 't3', 't4']) {
      const shuffled = shuffleQuestionsForSubmission(questions, token);
      for (const q of shuffled) {
        const original = questions.find((o) => o.id === q.id)!;
        for (const letter of ['A', 'B', 'C', 'D'] as const) {
          const canonical = displayedToCanonicalLetter(token, q.id, letter) as 'A' | 'B' | 'C' | 'D';
          expect(original.options[canonical]).toBe((q.options as Record<string, string>)[letter]);
        }
      }
    }
  });

  it('actually re-letters options for at least some questions', () => {
    const shuffled = shuffleQuestionsForSubmission(questions, 'tok-3');
    const moved = shuffled.filter((q) => (q.options as Record<string, string>).A !== questions.find((o) => o.id === q.id)!.options.A);
    expect(moved.length).toBeGreaterThan(0);
  });

  it('passes through non A-D values unchanged', () => {
    expect(displayedToCanonicalLetter('t', 'q0', '')).toBe('');
    expect(displayedToCanonicalLetter('t', 'q0', 'Z')).toBe('Z');
  });

  it('canonicalToDisplayedLetter is the inverse of displayedToCanonicalLetter', () => {
    for (const token of ['a', 'b', 'c']) {
      for (const letter of ['A', 'B', 'C', 'D']) {
        expect(canonicalToDisplayedLetter(token, 'q1', displayedToCanonicalLetter(token, 'q1', letter))).toBe(letter);
      }
    }
    expect(canonicalToDisplayedLetter('t', 'q0', '')).toBe('');
  });
});
