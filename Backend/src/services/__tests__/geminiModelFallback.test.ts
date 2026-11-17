const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));
jest.mock('../ai/azureOpenAiService', () => ({ isAzureOpenAiConfigured: () => false }));
jest.mock('../ai/azureChatCompletionService', () => ({
  callAzureChatCompletion: jest.fn(), callAzureChatCompletionFull: jest.fn(),
  pingPrimaryAzure: jest.fn(), pingSecondaryAzure: jest.fn(),
}));
jest.mock('../integrations/imageStorage', () => ({ uploadImage: jest.fn() }));
jest.mock('../../middleware/auth', () => ({ authenticate: jest.fn(), requireAdminRole: () => jest.fn() }));
jest.mock('../account/auditLogService', () => ({ logAdminAction: jest.fn() }));
jest.mock('../account/systemJunkCleanupService', () => ({ purgeSystemJunk: jest.fn() }));
jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

import { callTextModel } from '../ai/aiAgentService';
import { generateAgentReply } from '../ai/businessAiChatService';
import { clearCourseTutorCache, generateTutorReply } from '../learning/courseTutorService';
import { generateExamQuestions } from '../exams/examProctoringService';
import { pingGemini } from '../../routes/admin/adminSystemTools';

const payload = {
  mcqQuestions: [{ question: 'Question?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, correctAnswer: 'A' }],
  practicalQuestion: { question: 'Explain.', rubric: 'Accuracy.' },
};
const success = { response: { text: () => JSON.stringify(payload) } };
const callers: [string, () => Promise<unknown>][] = [
  ['AI agent', () => callTextModel('test', 0.1)],
  ['business chat', () => generateAgentReply({ systemPrompt: 'Help', knowledgeContext: '', history: [], message: 'test' })],
  ['course tutor', () => generateTutorReply({ lessonId: 'test', courseTitle: 'Test', courseDescription: '', sectionTitle: 'Section', lessonTitle: 'Lesson', assignmentPrompt: null, resources: [], history: [], message: 'test' })],
  ['exam proctoring', () => generateExamQuestions({ topic: 'Test', mcqCount: 1 })],
  ['health diagnostic', pingGemini],
];

beforeEach(() => {
  jest.useFakeTimers();
  mockGenerateContent.mockReset();
  mockGetGenerativeModel.mockClear();
  clearCourseTutorCache();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

describe.each(callers)('%s model selection', (_name, call) => {
  test('uses gemini-2.0-flash on success', async () => {
    mockGenerateContent.mockResolvedValue(success);
    await call();
    expect(mockGetGenerativeModel.mock.calls.map((args: unknown[]) => (args[0] as { model: string }).model)).toEqual(['gemini-2.0-flash']);
  });

  test.each([429, 503])('falls back immediately on HTTP %s, including status-only SDK errors', async (status) => {
    mockGenerateContent.mockRejectedValueOnce(Object.assign(new Error('Provider rejected request'), { status })).mockResolvedValue(success);
    const result = await call();
    expect(mockGetGenerativeModel.mock.calls.map((args: unknown[]) => (args[0] as { model: string }).model)).toEqual(['gemini-2.0-flash', 'gemini-1.5-flash']);
    if (_name === 'health diagnostic') expect(result).toMatchObject({ ok: true, message: expect.stringContaining('gemini-1.5-flash') });
  });
});

test('diagnostic does not hide an invalid API key with fallback', async () => {
  mockGenerateContent.mockRejectedValue(Object.assign(new Error('Invalid API key'), { status: 403 }));
  expect(await pingGemini()).toMatchObject({ ok: false, message: 'Invalid API key' });
  expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
});

test('diagnostic reports failure when both requested models are unavailable', async () => {
  mockGenerateContent.mockRejectedValueOnce(Object.assign(new Error('Busy'), { status: 503 }))
    .mockRejectedValueOnce(new Error('Fallback unavailable'));
  expect(await pingGemini()).toMatchObject({ ok: false, message: 'Fallback unavailable' });
});
