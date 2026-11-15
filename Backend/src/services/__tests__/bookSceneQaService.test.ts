jest.mock('../ai/azureChatCompletionService', () => ({ callAzureChatCompletionFull: jest.fn() }));
jest.mock('../childrensBook/bookMockConfig', () => ({ isBookAiMocked: jest.fn(() => false) }));

import sharp from 'sharp';
import { callAzureChatCompletionFull } from '../ai/azureChatCompletionService';
import { isBookAiMocked } from '../childrensBook/bookMockConfig';
import { reviewBookScene } from '../childrensBook/bookSceneQaService';

const verdict = {
  charactersMatch: true, settingMatches: true, actionMatches: true,
  noContradictions: true, childSafe: true, noPrintedText: true, corrections: '',
};
let buffer: Buffer;
beforeAll(async () => { buffer = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#eee' } }).png().toBuffer(); });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isBookAiMocked).mockReturnValue(false);
  jest.mocked(callAzureChatCompletionFull).mockResolvedValue({ content: JSON.stringify(verdict) });
});

it('sends both actual image bytes and the approved Georgian text to the visual reviewer', async () => {
  const text = 'სოფი ტყეში დათვს შეხვდა.';
  expect(await reviewBookScene({ buffer, storyText: text })).toMatchObject({ status: 'PASS', mocked: false });
  const request = jest.mocked(callAzureChatCompletionFull).mock.calls[0][0];
  expect(JSON.stringify(request.messages)).toContain(text);
  expect(JSON.stringify(request.messages)).toContain('data:image/jpeg;base64,');
  expect(request.signal).toBeDefined();
});

it('rejects a rabbit in place of the approved bear and supplies a targeted repair', async () => {
  jest.mocked(callAzureChatCompletionFull).mockResolvedValue({ content: JSON.stringify({ ...verdict, charactersMatch: false, corrections: 'Replace the rabbit with the bear described in the forest scene.' }) });
  expect(await reviewBookScene({ buffer, storyText: 'Mimi meets a bear in the forest.' })).toMatchObject({
    status: 'FAIL', reviewUnavailable: false, notes: expect.stringContaining('bear'),
  });
});

it.each(['settingMatches', 'actionMatches', 'noContradictions', 'childSafe', 'noPrintedText'])('rejects a failed %s check', async (check) => {
  jest.mocked(callAzureChatCompletionFull).mockResolvedValue({ content: JSON.stringify({ ...verdict, [check]: false }) });
  expect((await reviewBookScene({ buffer, storyText: 'Mimi meets a bear.' })).status).toBe('FAIL');
});

it.each(['{}', '{"charactersMatch":"true"}', 'not JSON'])('cannot accept an incomplete or malformed reviewer response: %s', async (content) => {
  jest.mocked(callAzureChatCompletionFull).mockResolvedValue({ content });
  expect(await reviewBookScene({ buffer, storyText: 'A bear.' })).toMatchObject({ status: 'FAIL', reviewUnavailable: true });
});

it('does not accept when the reviewer is down', async () => {
  jest.mocked(callAzureChatCompletionFull).mockRejectedValue(new Error('unavailable'));
  expect(await reviewBookScene({ buffer, storyText: 'A bear.' })).toMatchObject({ status: 'FAIL', reviewUnavailable: true });
});

it('rejects corrupt image bytes before calling the reviewer', async () => {
  expect(await reviewBookScene({ buffer: Buffer.from('broken'), storyText: 'A bear.' })).toMatchObject({ status: 'FAIL', reviewUnavailable: false });
  expect(callAzureChatCompletionFull).not.toHaveBeenCalled();
});

it('refuses missing page text even in mock mode', async () => {
  jest.mocked(isBookAiMocked).mockReturnValue(true);
  expect((await reviewBookScene({ buffer, storyText: ' ' })).status).toBe('FAIL');
});

it('keeps local mock mode deterministic without a paid AI call', async () => {
  jest.mocked(isBookAiMocked).mockReturnValue(true);
  expect(await reviewBookScene({ buffer, storyText: 'A bear.' })).toMatchObject({ status: 'PASS', mocked: true });
  expect(callAzureChatCompletionFull).not.toHaveBeenCalled();
});
