import { prisma } from '../../lib/prisma';
import { createUser } from '../../test/factories';
import { callTextModel } from '../aiAgentService';
import { generateTestAndAnswerKey, gradeHomework, generateBureaucracyDoc, generateParentLetter } from '../educatorHubAiService';
import { submitTeacherQuiz } from '../teacherQuizService';

// D8 — verifies the actual provider-bound prompt (the argument handed to
// callTextModel, mocked here so nothing is sent to a live AI provider)
// never contains the synthetic hard identifiers planted in each flow's
// free-text input. All fixture data below is fake/synthetic.

jest.mock('../aiAgentService', () => ({
  ...jest.requireActual('../aiAgentService'),
  callTextModel: jest.fn(),
}));

const FAKE_EMAIL = 'synthetic.parent.fixture@example.com';
const FAKE_PHONE = '+995 555 999 888';
const FAKE_ID = '01234567899';

function expectPromptScrubbed(prompt: string) {
  expect(prompt).not.toContain(FAKE_EMAIL);
  expect(prompt).not.toContain(FAKE_PHONE);
  expect(prompt).not.toContain(FAKE_ID);
}

function lastPrompt(): string {
  const calls = jest.mocked(callTextModel).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => jest.clearAllMocks());

describe('D8 — provider-bound prompts never contain synthetic hard identifiers', () => {
  it('Test generator: sourceText identifiers are stripped before the prompt is sent', async () => {
    jest.mocked(callTextModel).mockResolvedValue(
      JSON.stringify({ testSheet: 'x', answerKey: 'x', questions: [{ question: 'Q', type: 'MULTIPLE_CHOICE', correctAnswer: 'A' }] })
    );
    await generateTestAndAnswerKey({
      subject: 'Math',
      grade: '7',
      topic: 'Fractions',
      questionTypes: ['MULTIPLE_CHOICE'],
      difficulty: 'MEDIUM',
      questionCount: 5,
      language: 'en',
      sourceText: `See the worksheet; contact ${FAKE_EMAIL} or ${FAKE_PHONE}, student ID ${FAKE_ID}.`,
    });
    expectPromptScrubbed(lastPrompt());
  });

  it('Homework grading: studentWorkText identifiers are stripped before the prompt is sent', async () => {
    jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ score: '8/10', errorAnalysis: 'x', feedback: 'x' }));
    await gradeHomework({
      assignmentPrompt: 'Write a short essay.',
      studentWorkText: `My name's essay. Reach my parent at ${FAKE_EMAIL} or ${FAKE_PHONE}. ID ${FAKE_ID}.`,
      gradingScale: '0-10',
      language: 'en',
    });
    expectPromptScrubbed(lastPrompt());
  });

  it('Bureaucracy docs: keyPoints identifiers are stripped before the prompt is sent', async () => {
    jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ document: 'x' }));
    await generateBureaucracyDoc({
      documentType: 'ACTIVITY_REPORT',
      subject: 'Biology',
      grade: '9',
      keyPoints: `Ran a club session; parent contact ${FAKE_EMAIL}, ${FAKE_PHONE}, ID ${FAKE_ID}.`,
      language: 'en',
    });
    expectPromptScrubbed(lastPrompt());
  });

  it('Parent letters: teacherNotes identifiers are stripped AND the real student name is never sent to the AI', async () => {
    jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ letter: 'Dear parent(s) of STUDENT_NAME_PLACEHOLDER_TOKEN, ...' }));
    const result = await generateParentLetter({
      studentName: 'Synthetic Fixture Student',
      grade: '5',
      letterPurpose: 'PRAISE',
      teacherNotes: `Great improvement. Reach us at ${FAKE_EMAIL} or ${FAKE_PHONE}, ID ${FAKE_ID}.`,
      language: 'en',
    });
    const prompt = lastPrompt();
    expectPromptScrubbed(prompt);
    expect(prompt).not.toContain('Synthetic Fixture Student');
    // The real name IS restored locally into the final letter returned to the teacher.
    expect(result.letter).toContain('Synthetic Fixture Student');
    expect(result.letter).not.toContain('STUDENT_NAME_PLACEHOLDER_TOKEN');
  });

  it('Teacher Quiz free-text grading: the AI-bound copy of the student answer is stripped, but the persisted answer is not altered', async () => {
    jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ correct: true, feedback: 'Nice work!' }));
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const quiz = await prisma.teacherQuiz.create({
      data: {
        teacherId: teacher.id,
        title: 'Privacy Fixture Quiz',
        language: 'en',
        questions: { create: [{ order: 0, type: 'FREE_TEXT', question: 'Describe your project.', correctAnswer: 'Any reasonable description' }] },
      },
      include: { questions: true },
    });
    const questionId = quiz.questions[0].id;
    const rawAnswer = `My project log. Contact ${FAKE_EMAIL} or ${FAKE_PHONE}, ID ${FAKE_ID}.`;

    const submission = await submitTeacherQuiz(quiz.shareToken, 'Fixture Student', { [questionId]: rawAnswer });

    expectPromptScrubbed(lastPrompt());

    // The persisted answer must remain the student's original, unaltered text.
    const stored = await prisma.teacherQuizSubmission.findUnique({ where: { id: submission.submissionId } });
    const storedAnswers = stored?.answers as Record<string, string>;
    expect(storedAnswers[questionId]).toBe(rawAnswer);
  });
});
