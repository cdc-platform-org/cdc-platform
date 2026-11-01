import { BookLanguage } from '@prisma/client';
import { z } from 'zod';
import { callTextModel } from './aiAgentService';
import type { CharacterConfig } from './bookStoryPlanService';

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

const LANGUAGE_INSTRUCTIONS: Record<BookLanguage, string> = {
  KA: 'Write in natural, correct, warm Georgian (ქართული) as a native Georgian children\'s author would — not a translation.',
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
    'Rules: 2-4 short sentences per page (at most about 60 words); use the child\'s name; match each page\'s scene; no page numbers, headings or meta text; nothing scary, violent or unsafe.',
    'Scenes:',
    sceneList,
    'Reply with JSON only: {"pages":[{"pageNumber":1,"storyText":"..."}, ...]} with one entry per page.',
  ].join('\n\n');

  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.8, undefined, { timeoutMs: 90_000 });
  } catch (err) {
    throw new StoryTextGenerationError(`Story text generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    throw new StoryTextGenerationError('Story text generation returned an invalid response.');
  }

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
