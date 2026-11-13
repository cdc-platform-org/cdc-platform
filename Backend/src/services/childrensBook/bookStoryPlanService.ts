/**
 * Service (children's book generation).
 * Exports: StoryPlanPage, StoryPlan, CharacterConfig, planPagesFromFreshStory, generateStoryPlan,
 * syncScenesWithText.
 */
import { BookLanguage } from '@prisma/client';
import { isAllowedPageCount } from './bookStateService';
import { isBookAiMocked } from './bookMockConfig';
import { describeScenesFromText, writeFreshStory, pickStoryIdea, FreshStoryPage } from './bookStoryTextService';

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
  // The page text this scene was written for. When the parent edits the
  // text, the scene is re-described from the new words before any page is
  // drawn (syncScenesWithText), so pictures always follow the text.
  sceneSourceText?: string;
}

export interface StoryPlan {
  title: string;
  dedication: string | null;
  pages: StoryPlanPage[];
  // Set when the parent approves the (possibly edited) story text; no image
  // is generated for a new book before this (see routes/childrensBook.ts).
  textApprovedAt?: string | null;
  // Number of "write a new version" requests used before approval.
  textRegenerations?: number;
  // Story ideas already used for this book, so a new version picks another.
  storyIdeas?: string[];
}

export interface CharacterConfig {
  name: string;
  age?: number;
  traits?: string[];
  favoriteThing?: string;
  dedication?: string | null;
  // Optional extras (see bookCharacterDetailsService.ts).
  appearance?: string;
  extraCharacters?: string;
  photoKey?: string;
  photoMimeType?: string;
  siblings?: Array<{ name: string; age?: number; appearance?: string }>;
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
  const siblingNames = (character.siblings ?? []).map((sib) => sib.name).filter(Boolean);
  const extras = [siblingNames.join(', '), character.extraCharacters?.replace(/\s+/g, ' ').trim()].filter(Boolean).join(', ') || undefined;
  const pages: StoryPlanPage[] = ARC.slice(0, pageCount).map((step, i) => {
    const pageNumber = i + 1;
    // Supporting characters the parent asked for join on the first page and
    // stay in the scene descriptions so the illustrations include them.
    const withExtras = extras && pageNumber === 1;
    const storyText =
      language === 'KA'
        ? `${name}${withExtras ? ` (${extras})` : ''} ${step.beat === ARC[0].beat ? 'პოულობს' : 'აღმოაჩენს'} ახალ თავგადასავალს — გვერდი ${pageNumber}.`
        : `${name}${withExtras ? `, together with ${extras},` : ''} ${step.beat} — a new page in the adventure (page ${pageNumber}).`;
    return {
      pageNumber,
      storyText,
      sceneDescription: `${name} ${step.beat}${extras ? ` (supporting characters nearby: ${extras})` : ''}`,
      emotion: step.emotion,
      characterAction: step.beat,
      objectInteraction: pageNumber % 3 === 0 ? 'interacts with a glowing magical object' : 'none',
      composition: pageNumber === 1 ? 'wide establishing shot, character centered' : 'medium shot, character slightly off-center, room for text',
      textSafeZone: 'upper-left 30% reserved, no illustration detail or generated text inside it',
      negativeRules: ['no readable text or letters anywhere in the image', extras ? 'no characters other than the main character and the listed supporting characters' : 'no extra characters not described in the scene', 'no logos or watermarks'],
    };
  });
  return { title, dedication: character.dedication ?? null, pages };
}

// Story pages from a freshly invented plot: the AI's own scene for each page,
// with the same composition/safety fields the template pages carry.
export function planPagesFromFreshStory(character: CharacterConfig, pages: FreshStoryPage[]): StoryPlanPage[] {
  const siblingNames = (character.siblings ?? []).map((sib) => sib.name).filter(Boolean);
  const extras = [siblingNames.join(', '), character.extraCharacters?.replace(/\s+/g, ' ').trim()].filter(Boolean).join(', ') || undefined;
  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    storyText: page.storyText,
    sceneDescription: `${page.sceneDescription}${extras ? ` (supporting characters nearby: ${extras})` : ''}`,
    emotion: page.emotion,
    characterAction: page.sceneDescription,
    objectInteraction: 'as described in the scene',
    composition: page.pageNumber === 1 ? 'wide establishing shot, character centered' : 'medium shot, character slightly off-center, room for text',
    textSafeZone: 'upper-left 30% reserved, no illustration detail or generated text inside it',
    negativeRules: ['no readable text or letters anywhere in the image', extras ? 'no characters other than the main character and the listed supporting characters' : 'no extra characters not described in the scene', 'no logos or watermarks'],
    sceneSourceText: page.storyText,
  }));
}

export async function generateStoryPlan(params: { title: string; character: CharacterConfig; language: BookLanguage; pageCount: number; previousPlan?: StoryPlan | null }): Promise<StoryPlan> {
  if (!isAllowedPageCount(params.pageCount)) {
    throw new Error(`Story plan requires an allowed page count, got ${params.pageCount}.`);
  }
  // Mock mode keeps the deterministic template so local/CI runs never spend
  // a paid AI call. Real mode invents a new plot every time (text + scenes),
  // never the old fixed arc, and a new version avoids the earlier ones.
  const template = buildMockStoryPlan(params.title, params.character, params.language, params.pageCount);
  if (template.pages.length !== params.pageCount) {
    throw new Error(`Story plan invariant violated: expected exactly ${params.pageCount} pages, got ${template.pages.length}.`);
  }
  if (isBookAiMocked()) return { ...template, pages: template.pages.map((p) => ({ ...p, sceneSourceText: p.storyText })) };

  const previous = params.previousPlan;
  const usedIdeas = previous?.storyIdeas ?? [];
  const avoidPlots = previous ? [previous.pages.map((p) => p.sceneDescription).join(' / ').slice(0, 700)] : [];
  const story = await writeFreshStory({
    title: params.title,
    character: params.character,
    language: params.language,
    pageCount: params.pageCount,
    idea: pickStoryIdea(usedIdeas),
    avoidPlots,
  });
  return {
    title: params.title,
    dedication: params.character.dedication ?? null,
    pages: planPagesFromFreshStory(params.character, story.pages),
    storyIdeas: [...usedIdeas, story.idea],
  };
}

// Before pages are drawn: any page whose text changed since its scene was
// written (a parent edit, or an older book without sceneSourceText) gets its
// scene re-described from the current text. Returns the updated plan, or
// null when nothing changed. Mock mode uses the text itself as the scene.
export async function syncScenesWithText(params: {
  plan: StoryPlan;
  pages: Array<{ pageNumber: number; storyText: string | null }>;
  character: CharacterConfig;
}): Promise<StoryPlan | null> {
  const textByPage = new Map(params.pages.map((p) => [p.pageNumber, (p.storyText ?? '').trim()]));
  const stale = params.plan.pages.filter((pp) => {
    const text = textByPage.get(pp.pageNumber);
    return !!text && pp.sceneSourceText !== text;
  });
  if (stale.length === 0) return null;

  let scenes: Map<number, { sceneDescription: string; emotion?: string }>;
  if (isBookAiMocked()) {
    scenes = new Map(stale.map((pp) => [pp.pageNumber, { sceneDescription: textByPage.get(pp.pageNumber)!.replace(/\s+/g, ' ').slice(0, 500) }]));
  } else {
    // Every page goes in (for continuity); only the stale ones are replaced.
    scenes = await describeScenesFromText({
      character: params.character,
      pages: params.plan.pages.map((pp) => ({ pageNumber: pp.pageNumber, storyText: textByPage.get(pp.pageNumber) || pp.storyText })),
    });
  }
  const staleNumbers = new Set(stale.map((pp) => pp.pageNumber));
  return {
    ...params.plan,
    pages: params.plan.pages.map((pp) => {
      const scene = scenes.get(pp.pageNumber);
      if (!staleNumbers.has(pp.pageNumber) || !scene) return pp;
      const text = textByPage.get(pp.pageNumber)!;
      return {
        ...pp,
        storyText: text,
        sceneDescription: scene.sceneDescription,
        characterAction: scene.sceneDescription,
        objectInteraction: 'as described in the scene',
        ...(scene.emotion ? { emotion: scene.emotion } : {}),
        sceneSourceText: text,
      };
    }),
  };
}
