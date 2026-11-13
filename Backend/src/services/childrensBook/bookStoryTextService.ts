/**
 * Service (children's book generation).
 * Exports: StoryTextGenerationError, isPlaceholderStoryText, GEORGIAN_RULES, writeStoryTexts,
 * proofreadGeorgian, MAX_EDITED_STORY_TEXT_LENGTH, MAX_STORY_TEXT_REGENERATIONS, StoryTextEdit,
 * validateStoryTextEdits, STORY_IDEAS, pickStoryIdea, FreshStoryPage, writeFreshStory,
 * describeScenesFromText.
 */
import { BookLanguage } from '@prisma/client';
import { z } from 'zod';
import { callTextModel } from '../ai/aiAgentService';
import type { CharacterConfig } from './bookStoryPlanService';
import { siblingsStoryLine } from './bookCharacterDetailsService';

// ============================================================
// Children's Book — real story text. The story plan's scene beats (what each
// illustration shows) come from bookStoryPlanService's fixed arc; this
// service asks the text model to write the actual fairy-tale prose for those
// exact scenes, in the book's language, so text and pictures match.
//
// Used both when a new story plan is generated and to rewrite the text of an
// existing book whose pages still carry the old placeholder template (the
// illustrations are kept — only the words change). Fails loudly: a book must
// never silently fall back to placeholder text again.
// ============================================================

export class StoryTextGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryTextGenerationError';
  }
}

// The pre-AI template: "<name> აღმოაჩენს ახალ თავგადასავალს — გვერდი 2." /
// "... — a new page in the adventure (page 2)."
const PLACEHOLDER_PATTERNS = [/ახალ თავგადასავალს — გვერდი \d+\.?$/, /a new page in the adventure \(page \d+\)\.?$/];

export function isPlaceholderStoryText(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

const responseSchema = z.object({
  pages: z.array(z.object({ pageNumber: z.number().int(), storyText: z.string().trim().min(20).max(900) })),
});

// Georgian needs much more than "write in Georgian": the model's first
// draft tended to be a literal translation of English with wrong case
// endings and verb forms ("ველი მათ პატივს აძლევდა", "ხეების ჭალა ... რომლებიც
// ჰგავდნენ"). The rules below name the mistakes it actually made, and every
// KA text then goes through a separate proofreading pass (proofreadGeorgian).
export const GEORGIAN_RULES = [
  'Write directly in Georgian (ქართული) as an experienced native Georgian children\'s author would. Do NOT think in English and translate: no calques or English word order.',
  'Grammar must be flawless literary Georgian (სალიტერატურო ქართული):',
  '- correct case for the subject: ergative (-მა/-მ) with transitive verbs in the aorist (სოფიმ დაინახა), nominative with present/future (სოფი ხედავს), dative subject with inversive verbs (სოფის უყვარს, სოფის შეეძლო);',
  '- verb agreement in person and number with subject and objects, and correct preverbs and screeves (მიადგნენ, ამოისუნთქა, გაიღიმა);',
  '- correct noun cases and postpositions (-ში, -ზე, -თან, -ისკენ, -ით, -ად), adjective agreement and correct plural forms;',
  '- natural word choice: everyday words a 4-8 year old understands; no invented words, no rare or bookish words, no archaisms; idioms only if they are real Georgian idioms;',
  '- short, clear sentences (mostly 6-14 words); correct punctuation with Georgian quotation marks „...“ for speech;',
  '- keep the child\'s name exactly as given and decline it correctly (სოფი → სოფიმ, სოფის, სოფისთვის).',
].join('\n');

const LANGUAGE_INSTRUCTIONS: Record<BookLanguage, string> = {
  KA: GEORGIAN_RULES,
  EN: 'Write in natural, warm English as a native children\'s author would.',
};

export async function writeStoryTexts(params: {
  title: string;
  character: CharacterConfig;
  language: BookLanguage;
  scenes: Array<{ pageNumber: number; sceneDescription: string; emotion?: string }>;
}): Promise<Map<number, string>> {
  const { title, character, language, scenes } = params;
  const details = [
    `Main character: ${character.name}${character.age ? `, ${character.age} years old` : ''}.`,
    character.traits?.length ? `Personality: ${character.traits.join(', ')}.` : '',
    character.favoriteThing ? `Favourite thing: ${character.favoriteThing}.` : '',
    character.appearance ? `Appearance: ${character.appearance}.` : '',
    character.extraCharacters ? `Other characters who appear: ${character.extraCharacters}.` : '',
    siblingsStoryLine(character),
  ].filter(Boolean).join('\n');

  const sceneList = scenes
    .map((s) => `Page ${s.pageNumber}: ${s.sceneDescription}${s.emotion ? ` (mood: ${s.emotion})` : ''}`)
    .join('\n');

  const prompt = [
    'You are writing a personalised illustrated fairy tale for a young child.',
    `Book title: "${title}".`,
    details,
    LANGUAGE_INSTRUCTIONS[language],
    `The book has exactly ${scenes.length} pages. Each page already has an illustration showing the scene below. Write the story text for every page so the whole book reads as one continuous, gentle, age-appropriate story with a clear beginning and a warm ending.`,
    'Rules: 2-4 short sentences per page (at most about 60 words); any companion creature or animal keeps the same name and description on every page; use the child\'s name; match each page\'s scene; no page numbers, headings or meta text; nothing scary, violent or unsafe.',
    'Scenes:',
    sceneList,
    'Reply with JSON only: {"pages":[{"pageNumber":1,"storyText":"..."}, ...]} with one entry per page.',
  ].join('\n\n');

  let raw: string;
  try {
    raw = await callTextModel(prompt, language === 'KA' ? 0.6 : 0.8, undefined, { timeoutMs: 90_000 });
  } catch (err) {
    throw new StoryTextGenerationError(`Story text generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    throw new StoryTextGenerationError('Story text generation returned an invalid response.');
  }

  if (language === 'KA') parsed = { pages: await proofreadGeorgian(parsed.pages, character.name) };

  const texts = new Map<number, string>();
  for (const page of parsed.pages) texts.set(page.pageNumber, page.storyText.trim());
  for (const scene of scenes) {
    const text = texts.get(scene.pageNumber);
    if (!text || isPlaceholderStoryText(text)) {
      throw new StoryTextGenerationError(`Story text generation returned no text for page ${scene.pageNumber}.`);
    }
  }
  return texts;
}

// ============================================================
// Georgian proofreading pass: a second, low-temperature call whose only job
// is to correct grammar, morphology, spelling and unnatural (translated)
// phrasing while keeping the story. If the proofreader fails or returns
// something unusable the original draft is kept, page by page, so this
// step can only improve a text, never lose one.
// ============================================================
export async function proofreadGeorgian(
  pages: Array<{ pageNumber: number; storyText: string }>,
  childName: string,
): Promise<Array<{ pageNumber: number; storyText: string }>> {
  const prompt = [
    'You are a senior Georgian language editor (ქართული ენის რედაქტორი) of children\'s books. Proofread the story below.',
    GEORGIAN_RULES,
    'Check every sentence word by word: case endings, verb person/number agreement, preverbs and tense, postpositions, plural and adjective agreement, spelling, punctuation, and whether a native Georgian would actually say it that way. Rewrite any sentence that sounds translated or unnatural into simple, natural Georgian with the same meaning.',
    `Keep the plot, the events of each page and the name "${childName}" (declined correctly). Keep 2-4 short sentences per page. Do not add page numbers, headings or comments.`,
    'Story (JSON):',
    JSON.stringify({ pages }),
    'Reply with JSON only, same shape: {"pages":[{"pageNumber":1,"storyText":"..."}, ...]} with every page.',
  ].join('\n\n');

  try {
    const raw = await callTextModel(prompt, 0.2, undefined, { timeoutMs: 90_000 });
    const parsed = responseSchema.parse(JSON.parse(raw));
    const byPage = new Map(parsed.pages.map((p) => [p.pageNumber, p.storyText.trim()]));
    return pages.map((page) => {
      const fixed = byPage.get(page.pageNumber);
      return fixed && !isPlaceholderStoryText(fixed) ? { pageNumber: page.pageNumber, storyText: fixed } : page;
    });
  } catch (err) {
    console.warn('[childrens-book] Georgian proofreading failed, keeping the draft:', err instanceof Error ? err.message : err);
    return pages;
  }
}

// ============================================================
// Parent edits of the story text. The parent reviews (and may edit) every
// page's words before any image is generated, because the pictures are
// drawn from this text. Only the words change here — the scene beats stay.
// ============================================================

export const MAX_EDITED_STORY_TEXT_LENGTH = 1200;
// How many times the parent may ask for a brand-new version of the story
// before approving it (text only, no image cost, but not unlimited).
export const MAX_STORY_TEXT_REGENERATIONS = 3;

export type StoryTextEdit = { pageNumber: number; storyText: string };

export function validateStoryTextEdits(
  raw: unknown,
  pageNumbers: number[],
): { ok: true; value: StoryTextEdit[] } | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: 'No page text was sent.' };
  if (raw.length > pageNumbers.length) return { ok: false, message: 'Too many pages.' };
  const seen = new Set<number>();
  const value: StoryTextEdit[] = [];
  for (const entry of raw) {
    const pageNumber = Number((entry as any)?.pageNumber);
    if (!Number.isInteger(pageNumber) || !pageNumbers.includes(pageNumber)) return { ok: false, message: 'Unknown page.' };
    if (seen.has(pageNumber)) return { ok: false, message: `Page ${pageNumber} was sent twice.` };
    seen.add(pageNumber);
    const rawText = (entry as any)?.storyText;
    if (typeof rawText !== 'string') return { ok: false, message: `Page ${pageNumber} has no text.` };
    // Keep line breaks, drop other control characters.
    const storyText = rawText.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!storyText) return { ok: false, message: `Page ${pageNumber} cannot be empty.` };
    if (storyText.length > MAX_EDITED_STORY_TEXT_LENGTH) {
      return { ok: false, message: `Page ${pageNumber} is too long (at most ${MAX_EDITED_STORY_TEXT_LENGTH} characters).` };
    }
    value.push({ pageNumber, storyText });
  }
  return { ok: true, value };
}

// ============================================================
// A fresh, original plot for every book. The old flow always drew the same
// fixed 20-beat arc (glowing map in the attic -> forest -> owl ...) and only
// re-worded it, so every book, and every "new version", told the same story.
// Now the text model invents the plot, the text AND what each illustration
// shows, steered by a randomly picked story idea and told what to avoid.
// ============================================================

export const STORY_IDEAS = [
  'a lost baby star that fell into the garden and must get back to the sky',
  'a kite that carries the child over a village of friendly clouds',
  'an underwater kingdom where a shy little fish needs a friend',
  'a toy that comes to life at night and needs help finding its missing button',
  'a snowy mountain where a baby snow leopard has lost its mother',
  'a baking day where the bread rises so high it floats away',
  'a lighthouse whose light went out before a stormy night',
  'a tiny dragon who is afraid of the dark',
  'a garden where every flower plays a different musical note',
  'a rainbow that lost one of its colours',
  'a hot-air balloon trip to an island of giant fruit',
  'a sleepy moon who forgot how to shine',
  'a circus of animals preparing their very first show',
  'a seed that grows into a beanstalk overnight',
  'a ladybug postman who needs help delivering letters before the rain',
  'a rocket made of cardboard boxes that really flies to the moon',
  'a forest festival where every animal must bring a gift',
  'a little boat sailing down a river to the sea',
  "a grandmother's old clock that can pause time for one afternoon",
  "a playful wind that keeps hiding people's hats",
  'a puppy who wants to learn to swim',
  'a library where characters step out of the books',
  'a vineyard harvest day with talking grapes',
  'a magic paintbrush whose drawings come to life',
] as const;

export function pickStoryIdea(exclude: string[] = [], random: () => number = Math.random): string {
  const pool = STORY_IDEAS.filter((idea) => !exclude.includes(idea));
  const list = pool.length ? pool : [...STORY_IDEAS];
  return list[Math.floor(random() * list.length) % list.length];
}

const freshStorySchema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number().int(),
    storyText: z.string().trim().min(20).max(900),
    sceneDescription: z.string().trim().min(10).max(600),
    emotion: z.string().trim().min(2).max(40),
  })),
});

export interface FreshStoryPage {
  pageNumber: number;
  storyText: string;
  sceneDescription: string;
  emotion: string;
}

function characterDetails(character: CharacterConfig): string {
  return [
    `Main character: ${character.name}${character.age ? `, ${character.age} years old` : ''}.`,
    character.traits?.length ? `Personality: ${character.traits.join(', ')}.` : '',
    character.favoriteThing ? `Favourite thing: ${character.favoriteThing}.` : '',
    character.appearance ? `Appearance: ${character.appearance}.` : '',
    character.extraCharacters ? `Other characters who appear: ${character.extraCharacters}.` : '',
    siblingsStoryLine(character),
  ].filter(Boolean).join('\n');
}

export async function writeFreshStory(params: {
  title: string;
  character: CharacterConfig;
  language: BookLanguage;
  pageCount: number;
  // Short summaries of earlier versions of this book: the new one must differ.
  avoidPlots?: string[];
  idea?: string;
}): Promise<{ idea: string; pages: FreshStoryPage[] }> {
  const { title, character, language, pageCount } = params;
  const idea = params.idea ?? pickStoryIdea();
  const avoid = (params.avoidPlots ?? []).filter(Boolean);
  const prompt = [
    'You are an award-winning author of personalised illustrated fairy tales for young children.',
    `Book title: "${title}".`,
    characterDetails(character),
    LANGUAGE_INSTRUCTIONS[language],
    `Invent an ORIGINAL story for this book. If the title names a place or theme, the story happens there; otherwise build it around this idea: ${idea}. Make the plot your own: a specific little problem, a surprising turn, a clever or kind solution and a warm ending. Avoid cliches such as finding a magic map in the attic or a box in the fridge.`,
    avoid.length ? `These versions were already written for this book. The new story must be clearly different (different problem, places and events):\n- ${avoid.join('\n- ')}` : '',
    `The book has exactly ${pageCount} pages. For every page write:`,
    "- \"storyText\": 2-4 short sentences (at most about 60 words) in the book's language; any companion creature keeps the same name and look on every page; use the child's name; nothing scary, violent or unsafe; no page numbers or headings;",
    "- \"sceneDescription\": in ENGLISH, one or two sentences describing exactly what the illustration of that page shows: who is there, where, what they are doing and the key objects. It must match that page's storyText precisely;",
    "- \"emotion\": one English word for the main character's mood.",
    'Reply with JSON only: {"pages":[{"pageNumber":1,"storyText":"...","sceneDescription":"...","emotion":"..."}, ...]} with one entry per page.',
  ].filter(Boolean).join('\n\n');

  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.95, undefined, { timeoutMs: 120_000 });
  } catch (err) {
    throw new StoryTextGenerationError(`Story generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: z.infer<typeof freshStorySchema>;
  try {
    parsed = freshStorySchema.parse(JSON.parse(raw));
  } catch {
    throw new StoryTextGenerationError('Story generation returned an invalid response.');
  }

  const byPage = new Map(parsed.pages.map((p) => [p.pageNumber, p]));
  let pages: FreshStoryPage[] = [];
  for (let n = 1; n <= pageCount; n += 1) {
    const page = byPage.get(n);
    if (!page || isPlaceholderStoryText(page.storyText)) throw new StoryTextGenerationError(`Story generation returned no text for page ${n}.`);
    pages.push({ pageNumber: n, storyText: page.storyText.trim(), sceneDescription: page.sceneDescription.trim(), emotion: page.emotion.trim() });
  }
  if (language === 'KA') {
    const proofread = await proofreadGeorgian(pages.map(({ pageNumber, storyText }) => ({ pageNumber, storyText })), character.name);
    const fixed = new Map(proofread.map((p) => [p.pageNumber, p.storyText]));
    pages = pages.map((p) => ({ ...p, storyText: fixed.get(p.pageNumber) ?? p.storyText }));
  }
  return { idea, pages };
}

// ============================================================
// Pictures follow the words. When the parent edits (or fully rewrites) a
// page, the illustration must show the NEW text, not the scene the old text
// was written for. This turns each page's final text into an English scene
// description for the image model. Fails loudly; the caller decides the
// fallback (the image prompt then uses the page text alone).
// ============================================================
const sceneSchema = z.object({
  pages: z.array(z.object({ pageNumber: z.number().int(), sceneDescription: z.string().trim().min(10).max(600), emotion: z.string().trim().max(40).optional() })),
});

export async function describeScenesFromText(params: {
  character: CharacterConfig;
  pages: Array<{ pageNumber: number; storyText: string }>;
}): Promise<Map<number, { sceneDescription: string; emotion?: string }>> {
  const prompt = [
    "You turn the pages of a children's picture book into illustration briefs. The story text may be in Georgian.",
    characterDetails(params.character),
    "For every page write \"sceneDescription\" in ENGLISH: one or two sentences describing exactly what that page's text describes, as a single picture: who is there (by name), where, what they are doing, and the key objects. Use only what the text (and the earlier pages, for continuity) says; do not invent other events. Also give \"emotion\": one English word for the main character's mood.",
    'Pages (JSON):',
    JSON.stringify({ pages: params.pages }),
    'Reply with JSON only: {"pages":[{"pageNumber":1,"sceneDescription":"...","emotion":"..."}, ...]} with one entry per page.',
  ].join('\n\n');
  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.2, undefined, { timeoutMs: 90_000 });
  } catch (err) {
    throw new StoryTextGenerationError(`Scene description failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: z.infer<typeof sceneSchema>;
  try {
    parsed = sceneSchema.parse(JSON.parse(raw));
  } catch {
    throw new StoryTextGenerationError('Scene description returned an invalid response.');
  }
  const result = new Map<number, { sceneDescription: string; emotion?: string }>();
  for (const p of parsed.pages) result.set(p.pageNumber, { sceneDescription: p.sceneDescription.trim(), emotion: p.emotion?.trim() || undefined });
  for (const page of params.pages) {
    if (!result.has(page.pageNumber)) throw new StoryTextGenerationError(`Scene description missing for page ${page.pageNumber}.`);
  }
  return result;
}
