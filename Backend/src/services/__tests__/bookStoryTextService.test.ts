jest.mock('../aiAgentService', () => ({ callTextModel: jest.fn() }));

import { callTextModel } from '../aiAgentService';
import { isPlaceholderStoryText, writeStoryTexts, StoryTextGenerationError } from '../bookStoryTextService';

const scenes = [
  { pageNumber: 1, sceneDescription: 'Sofi discovers a mysterious glowing map in the attic', emotion: 'curious' },
  { pageNumber: 2, sceneDescription: 'Sofi sets off on a first step into the unknown forest', emotion: 'excited' },
];
const character = { name: 'სოფი', age: 5, traits: ['brave'] };

describe('isPlaceholderStoryText', () => {
  it('detects the old Georgian and English templates and empty text', () => {
    expect(isPlaceholderStoryText('სოფი აღმოაჩენს ახალ თავგადასავალს — გვერდი 2.')).toBe(true);
    expect(isPlaceholderStoryText('Mimi follows a trail — a new page in the adventure (page 3).')).toBe(true);
    expect(isPlaceholderStoryText('')).toBe(true);
    expect(isPlaceholderStoryText(null)).toBe(true);
  });

  it('accepts real story text', () => {
    expect(isPlaceholderStoryText('სოფიმ სხვენში უცნაური, მოციმციმე რუკა იპოვა და გული სიხარულით აუჩქარდა.')).toBe(false);
  });
});

describe('writeStoryTexts', () => {
  it('returns one real text per scene from the model JSON', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(JSON.stringify({
      pages: [
        { pageNumber: 1, storyText: 'სოფიმ სხვენში უცნაური, მოციმციმე რუკა იპოვა.' },
        { pageNumber: 2, storyText: 'მეორე დილით სოფი ტყისკენ გაემართა, რუკა ხელში ეჭირა.' },
      ],
    }));
    const texts = await writeStoryTexts({ title: 'სოფი და ჯადოსნური ტყე', character, language: 'KA', scenes });
    expect(texts.get(1)).toContain('რუკა');
    expect(texts.get(2)).toContain('ტყისკენ');
    const prompt = jest.mocked(callTextModel).mock.calls[0][0];
    expect(prompt).toContain('Georgian');
    expect(prompt).toContain('Page 2: Sofi sets off');
  });

  it('fails loudly (never placeholder) when a page is missing', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(JSON.stringify({ pages: [{ pageNumber: 1, storyText: 'სოფიმ სხვენში უცნაური, მოციმციმე რუკა იპოვა.' }] }));
    await expect(writeStoryTexts({ title: 't', character, language: 'KA', scenes })).rejects.toBeInstanceOf(StoryTextGenerationError);
  });

  it('fails loudly on invalid JSON or provider errors', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce('not json');
    await expect(writeStoryTexts({ title: 't', character, language: 'EN', scenes })).rejects.toBeInstanceOf(StoryTextGenerationError);
    jest.mocked(callTextModel).mockRejectedValueOnce(new Error('503'));
    await expect(writeStoryTexts({ title: 't', character, language: 'EN', scenes })).rejects.toBeInstanceOf(StoryTextGenerationError);
  });
});

describe('Georgian proofreading pass', () => {
  beforeEach(() => jest.mocked(callTextModel).mockReset());

  it('sends every Georgian draft to a second, low-temperature proofreading call and uses its corrections', async () => {
    jest.mocked(callTextModel)
      .mockResolvedValueOnce(JSON.stringify({
        pages: [
          { pageNumber: 1, storyText: 'სოფი სხვენში უცნაური რუკა იპოვა და გაიხარა ძალიან.' },
          { pageNumber: 2, storyText: 'მეორე დილით სოფი ტყისკენ გაემართა, რუკა ხელში ეჭირა.' },
        ],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        pages: [
          { pageNumber: 1, storyText: 'სოფიმ სხვენში უცნაური რუკა იპოვა და ძალიან გაიხარა.' },
          { pageNumber: 2, storyText: 'მეორე დილით სოფი ტყისკენ გაემართა. რუკა ხელში ეჭირა.' },
        ],
      }));
    const texts = await writeStoryTexts({ title: 'სოფი', character, language: 'KA', scenes });
    expect(texts.get(1)).toBe('სოფიმ სხვენში უცნაური რუკა იპოვა და ძალიან გაიხარა.');
    expect(jest.mocked(callTextModel)).toHaveBeenCalledTimes(2);
    const [proofPrompt, temperature] = jest.mocked(callTextModel).mock.calls[1];
    expect(proofPrompt).toContain('ქართული ენის რედაქტორი');
    expect(proofPrompt).toContain('ergative');
    expect(temperature).toBeLessThanOrEqual(0.3);
  });

  it('keeps the draft when the proofreader fails', async () => {
    jest.mocked(callTextModel)
      .mockResolvedValueOnce(JSON.stringify({
        pages: [
          { pageNumber: 1, storyText: 'სოფიმ სხვენში უცნაური, მოციმციმე რუკა იპოვა.' },
          { pageNumber: 2, storyText: 'მეორე დილით სოფი ტყისკენ გაემართა, რუკა ხელში ეჭირა.' },
        ],
      }))
      .mockRejectedValueOnce(new Error('503'));
    const texts = await writeStoryTexts({ title: 'სოფი', character, language: 'KA', scenes });
    expect(texts.get(1)).toBe('სოფიმ სხვენში უცნაური, მოციმციმე რუკა იპოვა.');
  });

  it('does not proofread English books', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(JSON.stringify({
      pages: [
        { pageNumber: 1, storyText: 'Mimi found a strange glowing map in the attic.' },
        { pageNumber: 2, storyText: 'The next morning Mimi set off for the forest.' },
      ],
    }));
    await writeStoryTexts({ title: 'Mimi', character: { name: 'Mimi' }, language: 'EN', scenes });
    expect(jest.mocked(callTextModel)).toHaveBeenCalledTimes(1);
  });
});
