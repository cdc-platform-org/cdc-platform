import { z } from 'zod';
import { callTextModel } from './aiAgentService';
import { isBookAiMocked } from './bookMockConfig';
import { generateBookImage } from './bookImageGenerationService';
import { storeBookAsset } from './bookStorageService';
import { illustrationStylePromptLine } from './bookIllustrationStyles';
import { loadReferenceImage } from './bookCharacterDetailsService';

// ============================================================
// Children's Book — recurring cast. The main child is kept consistent by the
// approved portrait, but the story also has companions the parent never
// drew (the "small animal friend", a magical creature, the wise owl). Drawn
// from text alone, the image model invented a new creature on every page.
//
// Before the pages are drawn we therefore:
//   1. ask the text model for every recurring non-child character in the
//      approved story text and ONE fixed, very specific visual design for
//      each (written in English for the image model), and
//   2. draw a single character sheet with all of them in the book's style.
// Every page then gets the fixed descriptions in its prompt and the sheet
// as a second reference image. Both are stored on storyPlan.cast, so a
// retry or a later run reuses the same design instead of inventing a new
// one. Any failure here falls back to the old text-only behaviour: the
// book is never blocked by the cast step.
// ============================================================

export interface CastMember {
  name: string;
  look: string;
  pages: number[];
}

export interface BookCast {
  characters: CastMember[];
  sheetKey?: string | null;
  sheetMimeType?: string | null;
}

const MAX_CAST = 4;

const castSchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        look: z.string().trim().min(10).max(600),
        pages: z.array(z.number().int()).default([]),
      })
    )
    .max(10),
});

function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/"/g, "'").trim();
}

export function readCast(storyPlan: unknown): BookCast | null {
  const cast = (storyPlan as { cast?: BookCast } | null | undefined)?.cast;
  if (!cast || !Array.isArray(cast.characters)) return null;
  return cast;
}

export async function extractRecurringCast(params: {
  mainCharacterName: string;
  siblingNames: string[];
  extraCharacters?: string | null;
  illustrationStyle?: string | null;
  pages: Array<{ pageNumber: number; storyText: string | null; sceneDescription?: string }>;
}): Promise<CastMember[]> {
  const pageList = params.pages
    .map((p) => `Page ${p.pageNumber}: ${flatten(p.storyText ?? '')}${p.sceneDescription ? ` [scene: ${flatten(p.sceneDescription)}]` : ''}`)
    .join('\n');
  const excluded = [params.mainCharacterName, ...params.siblingNames].filter(Boolean).join(', ');
  const prompt = [
    'You are the art director of an illustrated children\'s book. The story text may be in Georgian.',
    `Main child (already has an approved portrait, do NOT include): ${excluded || 'the main child'}.`,
    params.extraCharacters ? `The parent described these extra characters (use their wishes when designing them): "${flatten(params.extraCharacters)}".` : '',
    illustrationStylePromptLine(params.illustrationStyle),
    'List every NON-human-child character that appears in the story: animal friends, magical or mythical creatures, talking objects, adults, pets. Include a character even if it appears on only one page, and treat different names or descriptions of the same creature ("the little creature", "the magical friend", its name) as ONE character.',
    `For each give ONE fixed visual design in English that an illustrator must repeat identically on every page: species/kind, size relative to the child, body shape, exact main and secondary colours, eye colour and shape, distinctive markings or glow, accessories. Be concrete (e.g. "a small round lavender creature the size of a cat, with big turquoise eyes, two short curled antennae with glowing tips, a sky-blue swirling tail and tiny star-shaped freckles on the cheeks"). No text in images. At most ${MAX_CAST} characters, most important first.`,
    'Story pages:',
    pageList,
    'Reply with JSON only: {"characters":[{"name":"<name as used in the story or a short English label>","look":"<fixed design>","pages":[<page numbers where it appears>]}]}. If there are none, reply {"characters":[]}.',
  ].filter(Boolean).join('\n\n');

  const raw = await callTextModel(prompt, 0.3, undefined, { timeoutMs: 60_000 });
  const parsed = castSchema.parse(JSON.parse(raw));
  return parsed.characters.slice(0, MAX_CAST).map((c) => ({ name: flatten(c.name), look: flatten(c.look), pages: c.pages }));
}

export function castSheetPrompt(cast: CastMember[], illustrationStyle: string | null | undefined): string {
  return [
    'Character design sheet for a children\'s storybook.',
    illustrationStylePromptLine(illustrationStyle),
    `Draw these ${cast.length} character(s) standing side by side, full body, front three-quarter view, evenly lit on a plain light background, clearly separated, no human child:`,
    cast.map((c, i) => `${i + 1}) ${c.name}: ${c.look}`).join(' '),
    'No readable text, letters, labels or captions anywhere in the image.',
  ].join(' ');
}

// Page prompt fragment. `hasSheet` tells the model the second reference
// image is the cast sheet (the first is always the child's portrait).
export function castPromptLine(cast: BookCast | null, pageNumber: number, hasSheet: boolean): string {
  if (!cast?.characters?.length) return '';
  const onPage = cast.characters.filter((c) => !c.pages?.length || c.pages.includes(pageNumber));
  const list = (onPage.length ? onPage : cast.characters).map((c) => `${c.name}: ${c.look}`).join('; ');
  return [
    `Recurring characters of this book. Whenever one of them appears, draw it EXACTLY with this fixed design, identical on every page (same species, size, colours, eyes, markings); never redesign it: ${list}.`,
    hasSheet ? 'The LAST reference image is the official character sheet of these recurring characters: copy their look from it exactly. Use it only for their appearance, not for the composition.' : '',
  ].filter(Boolean).join(' ');
}

// Builds (or reuses) the book's cast. Returns the cast to use plus the
// sheet as a reference image when one exists. Never throws.
export async function ensureBookCast(params: {
  bookId: string;
  storyPlan: any;
  characterBible: any;
  illustrationStyle?: string | null;
  pages: Array<{ pageNumber: number; storyText: string | null }>;
  saveCast: (cast: BookCast) => Promise<void>;
}): Promise<{ cast: BookCast | null; sheetReference: Array<{ buffer: Buffer; mimeType: string }> }> {
  const existing = readCast(params.storyPlan);
  if (existing) {
    const sheetReference = existing.sheetKey ? await loadReferenceImage(existing.sheetKey, existing.sheetMimeType) : [];
    return { cast: existing, sheetReference };
  }
  if (isBookAiMocked()) return { cast: null, sheetReference: [] };

  let characters: CastMember[] = [];
  try {
    const planPages = (params.storyPlan?.pages ?? []) as Array<{ pageNumber: number; sceneDescription?: string }>;
    characters = await extractRecurringCast({
      mainCharacterName: params.characterBible?.name ?? '',
      siblingNames: (params.characterBible?.siblings ?? []).map((s: { name?: string }) => s?.name ?? '').filter(Boolean),
      extraCharacters: params.characterBible?.extraCharacters ?? null,
      illustrationStyle: params.illustrationStyle,
      pages: params.pages.map((p) => ({ ...p, sceneDescription: planPages.find((pp) => pp.pageNumber === p.pageNumber)?.sceneDescription })),
    });
  } catch (err) {
    console.warn(`[childrens-book] cast extraction failed for ${params.bookId}:`, err instanceof Error ? err.message : err);
    return { cast: null, sheetReference: [] };
  }

  const cast: BookCast = { characters };
  let sheetReference: Array<{ buffer: Buffer; mimeType: string }> = [];
  if (characters.length) {
    // Up to two tries: one cheap image that every page of the book reuses.
    for (let attempt = 0; attempt < 2 && !cast.sheetKey; attempt += 1) {
      const result = await generateBookImage({ prompt: castSheetPrompt(characters, params.illustrationStyle), size: '1536x1024', quality: 'medium' });
      if (result.success) {
        const key = `books/${params.bookId}/cast-sheet.png`;
        try {
          await storeBookAsset(key, result.buffer, result.mimeType);
          cast.sheetKey = key;
          cast.sheetMimeType = result.mimeType;
          sheetReference = [{ buffer: result.buffer, mimeType: result.mimeType }];
        } catch (err) {
          console.warn(`[childrens-book] cast sheet store failed for ${params.bookId}:`, err instanceof Error ? err.message : err);
        }
      } else {
        console.warn(`[childrens-book] cast sheet attempt ${attempt + 1} failed for ${params.bookId}: ${result.errorClassification}`);
      }
    }
  }
  try {
    await params.saveCast(cast);
  } catch (err) {
    console.warn(`[childrens-book] cast save failed for ${params.bookId}:`, err instanceof Error ? err.message : err);
  }
  return { cast, sheetReference };
}
