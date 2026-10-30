import { BookLanguage } from '@prisma/client';
import { isAllowedPageCount } from './bookStateService';

// ============================================================
// Children's Book — Story Plan generation.
//
// Real production interface: `generateStoryPlan`. Internally mock-first
// (see isBookAiMocked()) — the mock path is a deterministic, structured
// 10-page template driven by the character's name/traits, not a stub that
// returns garbage; it exercises the full StoryPlan shape routes/PDF
// generation actually consume. Swapping the mock branch for a real
// text-AI call is a drop-in replacement of buildMockStoryPlan() alone —
// every caller only ever sees a StoryPlanPage[].
// ============================================================

export interface StoryPlanPage {
  pageNumber: number;
  storyText: string;
  sceneDescription: string;
  emotion: string;
  characterAction: string;
  objectInteraction: string;
  composition: string;
  textSafeZone: string;
  negativeRules: string[];
}

export interface StoryPlan {
  title: string;
  dedication: string | null;
  pages: StoryPlanPage[];
}

export interface CharacterConfig {
  name: string;
  age?: number;
  traits?: string[];
  favoriteThing?: string;
  dedication?: string | null;
}

// 20 distinct beats, one coherent arc — ALLOWED_PAGE_COUNTS (5/10/15/20)
// are each exactly ARC.slice(0, pageCount), so every allowed length is
// still "the start of the same story told at different lengths" rather
// than a differently-shaped plot per page count.
const ARC = [
  { emotion: 'curious', beat: 'discovers a mysterious glowing map in the attic' },
  { emotion: 'excited', beat: 'sets off on a first step into the unknown forest' },
  { emotion: 'wondering', beat: 'follows a trail of glowing mushrooms deeper into the trees' },
  { emotion: 'determined', beat: 'meets a small animal friend who needs help' },
  { emotion: 'playful', beat: 'builds a clever plan together with the new friend' },
  { emotion: 'focused', beat: 'gathers three shining acorns the plan requires' },
  { emotion: 'nervous', beat: 'faces a rickety bridge over a sparkling river' },
  { emotion: 'brave', beat: 'crosses the bridge and finds a hidden valley' },
  { emotion: 'amazed', beat: 'discovers a grove of trees that glow like lanterns at dusk' },
  { emotion: 'curious', beat: 'meets a wise old owl who knows the forest\'s oldest secret' },
  { emotion: 'thoughtful', beat: 'listens carefully to the owl\'s riddle about the hidden valley' },
  { emotion: 'excited', beat: 'solves the riddle and finds a hidden path behind a waterfall' },
  { emotion: 'surprised', beat: 'uncovers the real secret the map was pointing to' },
  { emotion: 'determined', beat: 'helps the forest friends protect the secret together' },
  { emotion: 'joyful', beat: 'celebrates together with new and old friends' },
  { emotion: 'proud', beat: 'is thanked by every creature whose help made the day possible' },
  { emotion: 'warm', beat: 'shares a cozy meal together as the sun begins to set' },
  { emotion: 'grateful', beat: 'says a warm goodbye and promises to visit again' },
  { emotion: 'sleepy', beat: 'walks the path home under the first evening stars' },
  { emotion: 'peaceful', beat: 'returns home and falls asleep dreaming of the next adventure' },
] as const;

function buildMockStoryPlan(title: string, character: CharacterConfig, language: BookLanguage, pageCount: number): StoryPlan {
  const name = character.name || (language === 'KA' ? 'გმირი' : 'the hero');
  const pages: StoryPlanPage[] = ARC.slice(0, pageCount).map((step, i) => {
    const pageNumber = i + 1;
    const storyText =
      language === 'KA'
        ? `${name} ${step.beat === ARC[0].beat ? 'პოულობს' : 'აღმოაჩენს'} ახალ თავგადასავალს — გვერდი ${pageNumber}.`
        : `${name} ${step.beat} — a new page in the adventure (page ${pageNumber}).`;
    return {
      pageNumber,
      storyText,
      sceneDescription: `${name} ${step.beat}`,
      emotion: step.emotion,
      characterAction: step.beat,
      objectInteraction: pageNumber % 3 === 0 ? 'interacts with a glowing magical object' : 'none',
      composition: pageNumber === 1 ? 'wide establishing shot, character centered' : 'medium shot, character slightly off-center, room for text',
      textSafeZone: 'upper-left 30% reserved, no illustration detail or generated text inside it',
      negativeRules: ['no readable text or letters anywhere in the image', 'no extra characters not described in the scene', 'no logos or watermarks'],
    };
  });
  return { title, dedication: character.dedication ?? null, pages };
}

export function generateStoryPlan(params: { title: string; character: CharacterConfig; language: BookLanguage; pageCount: number }): StoryPlan {
  if (!isAllowedPageCount(params.pageCount)) {
    throw new Error(`Story plan requires an allowed page count, got ${params.pageCount}.`);
  }
  // Mock-first by design (Phase/Batch policy: never spend a paid text-AI
  // call during routine plumbing). A real LLM-backed implementation would
  // branch on isBookAiMocked() here exactly like bookCharacterPreviewService
  // does for images — deliberately not wired to a real provider yet since
  // no real text-AI call has been authorized for this product.
  const plan = buildMockStoryPlan(params.title, params.character, params.language, params.pageCount);
  if (plan.pages.length !== params.pageCount) {
    throw new Error(`Story plan invariant violated: expected exactly ${params.pageCount} pages, got ${plan.pages.length}.`);
  }
  return plan;
}
