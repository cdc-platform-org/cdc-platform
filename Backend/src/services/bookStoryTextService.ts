import { BookLanguage } from '@prisma/client';
import { z } from 'zod';
import { callTextModel } from './aiAgentService';
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
const GEORGIAN_RULES = [
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
