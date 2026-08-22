// Mocked at the callTextModel boundary (aiAgentService.ts) — this suite is
// about generateExamQuestions's own JSON-parsing/schema/length validation,
// not about the Gemini/Azure resilience chain underneath it (that's
// aiAgentService's own concern). No real network call happens here.
jest.mock('../aiAgentService', () => ({
  ...jest.requireActual('../aiAgentService'),
  callTextModel: jest.fn(),
}));

import { generateExamQuestions, AiExamGenerationError } from '../aiExamService';
import { callTextModel } from '../aiAgentService';

const mockedCallTextModel = callTextModel as jest.MockedFunction<typeof callTextModel>;

const baseParams = {
  courseTitle: 'Interior Design',
  courseDescription: 'General interior design freelance skills.',
  lessonTitles: ['color theory', 'space planning'],
  questionCount: 15,
};

function makeQuestion(i: number) {
  return {
    topic: `topic-${i}`,
    question: `Question ${i}?`,
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    correctAnswer: 'A' as const,
    explanation: `Explanation ${i}`,
  };
}

describe('generateExamQuestions', () => {
  beforeEach(() => {
    mockedCallTextModel.mockReset();
  });

  it('returns exactly questionCount questions when the AI provides at least that many', async () => {
    const questions = Array.from({ length: 15 }, (_, i) => makeQuestion(i));
    mockedCallTextModel.mockResolvedValue(JSON.stringify({ questions }));

    const result = await generateExamQuestions(baseParams);
    expect(result).toHaveLength(15);
  });

  it('slices down when the AI returns more than requested', async () => {
    const questions = Array.from({ length: 20 }, (_, i) => makeQuestion(i));
    mockedCallTextModel.mockResolvedValue(JSON.stringify({ questions }));

    const result = await generateExamQuestions(baseParams);
    expect(result).toHaveLength(15);
  });

  // The bug found during the QA audit: a schema-valid response with fewer
  // than questionCount questions used to pass straight through silently
  // (only an exactly-zero-length array was rejected) — a scored exam could
  // ship with fewer questions than the platform's own "N questions, need
  // X% correct" framing promised the student.
  it('throws AiExamGenerationError when the AI returns fewer questions than requested, even if non-empty', async () => {
    const questions = Array.from({ length: 9 }, (_, i) => makeQuestion(i));
    mockedCallTextModel.mockResolvedValue(JSON.stringify({ questions }));

    await expect(generateExamQuestions(baseParams)).rejects.toThrow(AiExamGenerationError);
  });

  it('throws AiExamGenerationError on a genuinely empty questions array', async () => {
    mockedCallTextModel.mockResolvedValue(JSON.stringify({ questions: [] }));
    await expect(generateExamQuestions(baseParams)).rejects.toThrow(AiExamGenerationError);
  });

  it('throws AiExamGenerationError on malformed JSON', async () => {
    mockedCallTextModel.mockResolvedValue('{not valid json');
    await expect(generateExamQuestions(baseParams)).rejects.toThrow('AI provider returned malformed JSON.');
  });

  it('throws AiExamGenerationError when the JSON is valid but does not match the question schema', async () => {
    mockedCallTextModel.mockResolvedValue(JSON.stringify({ questions: [{ notAQuestion: true }] }));
    await expect(generateExamQuestions(baseParams)).rejects.toThrow(AiExamGenerationError);
  });

  it('throws AiExamGenerationError on an empty response string', async () => {
    mockedCallTextModel.mockResolvedValue('');
    await expect(generateExamQuestions(baseParams)).rejects.toThrow('AI provider returned an empty response.');
  });

  it('propagates the underlying error message when callTextModel itself throws', async () => {
    mockedCallTextModel.mockRejectedValue(new Error('every model failed'));
    await expect(generateExamQuestions(baseParams)).rejects.toThrow(AiExamGenerationError);
  });
});
