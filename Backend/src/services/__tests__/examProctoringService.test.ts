// examProctoringService.ts builds its own GoogleGenerativeAI client
// directly (unlike aiExamService.ts, which goes through
// aiAgentService.callTextModel) — mocked at the SDK boundary instead, so
// generateExamQuestions's own JSON-parsing/schema/length validation is
// exercised without a real network call. jest.mock calls are hoisted above
// imports by Jest itself, which is required here since the module under
// test constructs its client at import time.
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
  })),
}));

import { generateExamQuestions, ExamProctoringAiError } from '../examProctoringService';

function mockGeminiJson(payload: unknown) {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(payload), usageMetadata: undefined },
  });
}

function makeMcq(i: number) {
  return { question: `Question ${i}?`, options: { A: 'a', B: 'b', C: 'c', D: 'd' }, correctAnswer: 'A' as const };
}

const baseParams = { topic: 'Senior React Developer', mcqCount: 10 };

describe('examProctoringService.generateExamQuestions', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns the full question set when the AI provides at least mcqCount MCQs', async () => {
    mockGeminiJson({
      mcqQuestions: Array.from({ length: 10 }, (_, i) => makeMcq(i)),
      practicalQuestion: { question: 'Describe your approach.', rubric: 'Looks for depth and clarity.' },
    });

    const result = await generateExamQuestions(baseParams);
    expect(result.filter((q) => q.type === 'MCQ')).toHaveLength(10);
    expect(result.filter((q) => q.type === 'PRACTICAL')).toHaveLength(1);
  });

  // The bug found during the QA audit (same root cause as aiExamService.ts's
  // equivalent gap): a schema-valid response with fewer than mcqCount
  // MCQ questions used to pass straight through unchecked — an employer's
  // paid, configured screening exam could silently ship with fewer
  // questions than requested. This path has no static fallback bank (see
  // this file's own header comment), so failing loudly here — caught by
  // both routes/examProctoring.ts call sites — is the correct behavior.
  it('throws ExamProctoringAiError when the AI returns fewer MCQ questions than mcqCount', async () => {
    mockGeminiJson({
      mcqQuestions: Array.from({ length: 4 }, (_, i) => makeMcq(i)), // requested 10, got 4
      practicalQuestion: { question: 'Describe your approach.', rubric: 'Looks for depth and clarity.' },
    });

    await expect(generateExamQuestions(baseParams)).rejects.toThrow(ExamProctoringAiError);
    await expect(generateExamQuestions(baseParams)).rejects.toThrow('fewer questions than requested');
  });

  it('throws ExamProctoringAiError on malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '{not valid', usageMetadata: undefined } });
    await expect(generateExamQuestions(baseParams)).rejects.toThrow('Gemini returned malformed JSON.');
  });

  it('includes the code question when requested and mcqCount is satisfied', async () => {
    mockGeminiJson({
      mcqQuestions: Array.from({ length: 10 }, (_, i) => makeMcq(i)),
      practicalQuestion: { question: 'Describe your approach.', rubric: 'Looks for depth and clarity.' },
      codeQuestion: { question: 'Implement a debounce function.', rubric: 'Correctness and edge cases.' },
    });

    const result = await generateExamQuestions({ ...baseParams, includeCodeQuestion: true });
    expect(result.filter((q) => q.type === 'CODE')).toHaveLength(1);
  });
});

describe('examProctoringService.generateExamQuestions — multiple-choice only', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns only MCQs when includePracticalQuestion is false', async () => {
    mockGeminiJson({ mcqQuestions: Array.from({ length: 15 }, (_, i) => makeMcq(i)) });
    const result = await generateExamQuestions({ topic: 'Biology — cells', mcqCount: 15, includePracticalQuestion: false });
    expect(result).toHaveLength(15);
    expect(result.every((q) => q.type === 'MCQ')).toBe(true);
  });

  it('still requires the practical question when it was requested', async () => {
    mockGeminiJson({ mcqQuestions: Array.from({ length: 5 }, (_, i) => makeMcq(i)) });
    await expect(generateExamQuestions({ topic: 'Biology', mcqCount: 5 })).rejects.toThrow(ExamProctoringAiError);
  });

  it('trims extra MCQs down to the requested count', async () => {
    mockGeminiJson({ mcqQuestions: Array.from({ length: 18 }, (_, i) => makeMcq(i)) });
    const result = await generateExamQuestions({ topic: 'History', mcqCount: 15, includePracticalQuestion: false });
    expect(result).toHaveLength(15);
  });

  it('puts the source material into the prompt so questions come from it', async () => {
    mockGeminiJson({ mcqQuestions: Array.from({ length: 3 }, (_, i) => makeMcq(i)) });
    await generateExamQuestions({ topic: 'ფოტოსინთეზი', mcqCount: 3, includePracticalQuestion: false, rawContent: 'მცენარეები იყენებენ მზის სინათლეს' });
    const prompt = mockGenerateContent.mock.calls[0][0] as string;
    expect(prompt).toContain('მცენარეები იყენებენ მზის სინათლეს');
    expect(prompt).toContain('SOURCE MATERIAL');
  });
});
