jest.mock('../ai/aiAgentService', () => ({ callTextModel: jest.fn() }));
jest.mock('../childrensBook/bookMockConfig', () => ({ ...jest.requireActual('../childrensBook/bookMockConfig'), isBookAiMocked: jest.fn(() => false) }));

import { callTextModel } from '../ai/aiAgentService';
import { isBookAiMocked } from '../childrensBook/bookMockConfig';
import { pickStoryIdea, STORY_IDEAS, writeFreshStory, StoryTextGenerationError } from '../childrensBook/bookStoryTextService';
import { generateStoryPlan, syncScenesWithText, StoryPlan } from '../childrensBook/bookStoryPlanService';

const character = { name: 'Mimi', age: 5 };

function storyJson(n: number, tag: string) {
  return JSON.stringify({
    pages: Array.from({ length: n }, (_, i) => ({
      pageNumber: i + 1,
      storyText: `${tag}: Mimi does something new on page ${i + 1} of this story.`,
      sceneDescription: `${tag} scene ${i + 1}: Mimi in a sunny meadow`,
      emotion: 'happy',
    })),
  });
}

beforeEach(() => {
  jest.mocked(callTextModel).mockReset();
  jest.mocked(isBookAiMocked).mockReturnValue(false);
});

describe('fresh story plots', () => {
  it('picks a story idea that was not used before', () => {
    const used = STORY_IDEAS.slice(0, STORY_IDEAS.length - 1) as unknown as string[];
    expect(pickStoryIdea(used)).toBe(STORY_IDEAS[STORY_IDEAS.length - 1]);
  });

  it('the plan uses the AI scenes (not the fixed attic-map arc) and records the idea', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(storyJson(5, 'A'));
    const plan = await generateStoryPlan({ title: 'Mimi', character, language: 'EN', pageCount: 5 });
    expect(plan.pages.map((p) => p.sceneDescription)).toEqual([1, 2, 3, 4, 5].map((n) => `A scene ${n}: Mimi in a sunny meadow`));
    expect(plan.pages.some((p) => /attic/.test(p.sceneDescription))).toBe(false);
    expect(plan.pages.every((p) => p.sceneSourceText === p.storyText)).toBe(true);
    expect(plan.storyIdeas).toHaveLength(1);
  });

  it('a new version is told to differ from the previous one and uses another idea', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(storyJson(5, 'A'));
    const first = await generateStoryPlan({ title: 'Mimi', character, language: 'EN', pageCount: 5 });
    jest.mocked(callTextModel).mockResolvedValueOnce(storyJson(5, 'B'));
    const second = await generateStoryPlan({ title: 'Mimi', character, language: 'EN', pageCount: 5, previousPlan: first });
    const prompt = jest.mocked(callTextModel).mock.calls[1][0] as string;
    expect(prompt).toContain('A scene 1');
    expect(prompt).toContain('must be clearly different');
    expect(second.storyIdeas).toHaveLength(2);
    expect(second.storyIdeas![1]).not.toBe(second.storyIdeas![0]);
  });

  it('fails loudly when a page is missing', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(storyJson(3, 'A'));
    await expect(writeFreshStory({ title: 't', character, language: 'EN', pageCount: 5 })).rejects.toBeInstanceOf(StoryTextGenerationError);
  });
});

describe('pictures follow the edited text', () => {
  const plan: StoryPlan = {
    title: 't',
    dedication: null,
    pages: [1, 2].map((n) => ({
      pageNumber: n,
      storyText: `Old text ${n}`,
      sceneDescription: `Old scene ${n}`,
      emotion: 'calm',
      characterAction: '',
      objectInteraction: '',
      composition: 'medium shot',
      textSafeZone: '',
      negativeRules: [],
      sceneSourceText: `Old text ${n}`,
    })),
  };

  it('does nothing when no page was edited', async () => {
    expect(await syncScenesWithText({ plan, pages: [{ pageNumber: 1, storyText: 'Old text 1' }, { pageNumber: 2, storyText: 'Old text 2' }], character })).toBeNull();
    expect(callTextModel).not.toHaveBeenCalled();
  });

  it('re-describes only the edited page from its new text', async () => {
    jest.mocked(callTextModel).mockResolvedValueOnce(JSON.stringify({
      pages: [
        { pageNumber: 1, sceneDescription: 'whatever for page one' },
        { pageNumber: 2, sceneDescription: 'Mimi, Temo and Mate follow a golden light into a silver forest' },
      ],
    }));
    const synced = await syncScenesWithText({ plan, pages: [{ pageNumber: 1, storyText: 'Old text 1' }, { pageNumber: 2, storyText: 'ბავშვები ოქროსფერ ნათებას გაჰყვნენ ტყეში.' }], character });
    expect(synced!.pages[0].sceneDescription).toBe('Old scene 1');
    expect(synced!.pages[1].sceneDescription).toBe('Mimi, Temo and Mate follow a golden light into a silver forest');
    expect(synced!.pages[1].sceneSourceText).toBe('ბავშვები ოქროსფერ ნათებას გაჰყვნენ ტყეში.');
    const prompt = jest.mocked(callTextModel).mock.calls[0][0] as string;
    expect(prompt).toContain('ოქროსფერ ნათებას');
  });

  it('treats an older book without sceneSourceText as edited', async () => {
    jest.mocked(isBookAiMocked).mockReturnValue(true);
    const legacy = { ...plan, pages: plan.pages.map(({ sceneSourceText: _s, ...rest }) => rest) };
    const synced = await syncScenesWithText({ plan: legacy, pages: [{ pageNumber: 1, storyText: 'Sofi bakes bread' }, { pageNumber: 2, storyText: 'The bread floats' }], character });
    expect(synced!.pages.map((p) => p.sceneDescription)).toEqual(['Sofi bakes bread', 'The bread floats']);
  });
});
