import { computeExamTotalScore, pointsPerQuestion } from '../examScoring';

describe('computeExamTotalScore', () => {
  it('weighs every question the same (15 MCQ + 1 open = 6.25 points each)', () => {
    expect(pointsPerQuestion(16)).toBe(6.25);
    // 5 of 15 right, open question 0 → 5/16 = 31%, not the old 17%
    expect(computeExamTotalScore({ mcqCorrect: 5, mcqTotal: 15, openScores: [0] })).toBe(31);
  });
  it('gives partial credit for an AI-graded open question', () => {
    expect(computeExamTotalScore({ mcqCorrect: 15, mcqTotal: 15, openScores: [50] })).toBe(97);
  });
  it('multiple-choice only', () => {
    expect(computeExamTotalScore({ mcqCorrect: 2, mcqTotal: 15, openScores: [] })).toBe(13);
  });
  it('returns null with no questions', () => {
    expect(computeExamTotalScore({ mcqCorrect: 0, mcqTotal: 0, openScores: [] })).toBeNull();
  });
});
