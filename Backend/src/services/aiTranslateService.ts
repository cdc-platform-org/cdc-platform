import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';
import { callTextModel, AiAgentError } from './aiAgentService';

export function isAiTranslateConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

export class AiTranslateError extends Error {
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'AiTranslateError';
    this.status = status;
  }
}

// Routes through aiAgentService.callTextModel() rather than calling Gemini
// directly — that's the one place in this codebase with the confirmed-live
// model fallback sequence (gemini-flash-latest -> gemini-flash-lite-latest
// -> gemini-3.5-flash, with per-model retries), built after this exact
// 'gemini-flash-latest' model was found intermittently 503ing ("high
// demand") on this account. Pinning to a single alternate model instead
// (e.g. gemini-2.5-flash) isn't viable either — that one now hard-404s
// ("no longer available to new users"), confirmed live against this
// project's API key.
async function generateTranslationJson(prompt: string): Promise<string> {
  try {
    return await callTextModel(prompt, 0.3);
  } catch (err) {
    if (err instanceof AiAgentError) throw new AiTranslateError(err.message, err.status);
    throw err;
  }
}

const translationResponseSchema = z.object({
  titleEn: z.string(),
  descriptionEn: z.string(),
  contentEn: z.string(),
});

export interface TranslateBlogPostParams {
  title: string;
  description: string;
  content: string;
}

export interface TranslateBlogPostResult {
  titleEn: string;
  descriptionEn: string;
  contentEn: string;
}

// Translates a Georgian blog draft's title/description/content into English
// in one Gemini call (cheaper and keeps the three fields contextually
// consistent, vs. three separate requests) — used by the "Auto-Translate to
// English" button in /admin/blog.
export async function translateBlogPost(params: TranslateBlogPostParams): Promise<TranslateBlogPostResult> {
  const prompt = `Translate the following Georgian blog post fields into natural, fluent English. Preserve meaning, tone, and any Markdown formatting in the content field — do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "descriptionEn": string, "contentEn": string}

title: ${params.title}
description: ${params.description}
content: ${params.content}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = translationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}

const studioCaseTranslationResponseSchema = z.object({
  titleEn: z.string(),
  descriptionEn: z.string(),
  fullStoryEn: z.string(),
});

export interface TranslateStudioCaseParams {
  title: string;
  description: string;
  fullStory: string;
}

export interface TranslateStudioCaseResult {
  titleEn: string;
  descriptionEn: string;
  fullStoryEn: string;
}

// Same shape/reasoning as translateBlogPost above — kept as a separate
// function (own prompt/field names) rather than generalizing the two,
// since the two callers' field names genuinely differ (content vs
// fullStory) and this function is small. Used by the "Auto-Translate to
// English" button in /admin/studio-cases. clientName/category are
// deliberately NOT translated here — see StudioCaseStudy's schema comment.
export async function translateStudioCase(params: TranslateStudioCaseParams): Promise<TranslateStudioCaseResult> {
  const prompt = `Translate the following Georgian CDC Studio portfolio case study fields into natural, fluent English. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "descriptionEn": string, "fullStoryEn": string}

title: ${params.title}
description: ${params.description}
fullStory: ${params.fullStory}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = studioCaseTranslationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}

const successStoryTranslationResponseSchema = z.object({
  roleTitleEn: z.string(),
  testimonialEn: z.string(),
  storyContentEn: z.string().optional(),
});

export interface TranslateSuccessStoryParams {
  roleTitle: string;
  testimonial: string;
  // Optional — many stories are just a short testimonial with no full
  // article, unlike StudioCaseStudy's fullStory which this otherwise
  // mirrors.
  storyContent?: string;
}

export interface TranslateSuccessStoryResult {
  roleTitleEn: string;
  testimonialEn: string;
  storyContentEn?: string;
}

// Same shape/reasoning as translateStudioCase above — studentName and
// courseName are deliberately NOT translated (see SuccessStory's schema
// comment: studentName is a proper noun, courseName mirrors the
// single-language category/clientName posture). Used by the "✨
// Auto-Translate to English" button in /admin/success-stories.
export async function translateSuccessStory(params: TranslateSuccessStoryParams): Promise<TranslateSuccessStoryResult> {
  const prompt = `Translate the following Georgian CDC student success story fields into natural, fluent English, suitable for a public alumni showcase. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON containing ONLY the keys corresponding to what was provided below (omit storyContentEn if storyContent is absent), using this shape:
{"roleTitleEn": string, "testimonialEn": string, "storyContentEn"?: string}

roleTitle: ${params.roleTitle}
testimonial: ${params.testimonial}${params.storyContent ? `\nstoryContent: ${params.storyContent}` : ''}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = successStoryTranslationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}

const mentorProfileTranslationResponseSchema = z.object({
  titleEn: z.string(),
  bioEn: z.string(),
});

export interface TranslateMentorProfileParams {
  title: string;
  bio: string;
}

export interface TranslateMentorProfileResult {
  titleEn: string;
  bioEn: string;
}

// Same shape/reasoning as translateBlogPost/translateStudioCase above —
// used by the "✨ Auto-Translate to English" button on a mentor's profile
// in /admin/mentorship.
export async function translateMentorProfile(params: TranslateMentorProfileParams): Promise<TranslateMentorProfileResult> {
  const prompt = `Translate the following Georgian mentor profile fields into natural, fluent English, suitable for a public mentor-directory listing. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "bioEn": string}

title: ${params.title}
bio: ${params.bio}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = mentorProfileTranslationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}

const teamMemberTranslationResponseSchema = z.object({
  nameEn: z.string(),
  roleEn: z.string(),
  bioEn: z.string(),
});

export interface TranslateTeamMemberParams {
  name: string;
  role: string;
  bio: string;
}

export interface TranslateTeamMemberResult {
  nameEn: string;
  roleEn: string;
  bioEn: string;
}

// Same shape/reasoning as translateMentorProfile above — used by the "✨
// Auto-Translate to English" button in /admin/team-trainers. `name` is a
// person's name, not translated for meaning like role/bio — transliterated
// to its standard Latin-script spelling instead (e.g. "ია თავდიშვილი" ->
// "Ia Tavdishvili"), same posture as SuccessStory's studentName being left
// untouched, just applied via transliteration here since this field IS
// shown in both locales (unlike studentName, which stays single-language).
export async function translateTeamMember(params: TranslateTeamMemberParams): Promise<TranslateTeamMemberResult> {
  const prompt = `Translate the following Georgian CDC team member / trainer profile fields for a public "About" page and trainer directory.
- "name" is a person's name — transliterate it to its standard Latin-script spelling (e.g. "ია თავდიშვილი" -> "Ia Tavdishvili"), do not translate its meaning.
- "role" and "bio" should be translated into natural, fluent English. Preserve meaning and tone; do not summarize or shorten.

Respond with strict JSON matching this shape:
{"nameEn": string, "roleEn": string, "bioEn": string}

name: ${params.name}
role: ${params.role}
bio: ${params.bio}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = teamMemberTranslationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}

const titleDescriptionTranslationSchema = z.object({
  titleEn: z.string(),
  descriptionEn: z.string(),
});

export interface TranslateTitleAndDescriptionResult {
  titleEn: string;
  descriptionEn: string;
}

// Shared by Digital Products and Tutorials (both a plain title+description
// pair, nothing else) — unlike blog/studio-case/mentor/team above, which
// each have their own distinct extra fields and stay as separate functions.
// Called automatically (not from an admin-clicked button) whenever
// titleEn/descriptionEn is left blank on create/update — see routes/
// products.ts, routes/adminProducts.ts, routes/tutorials.ts. Best-effort:
// every caller catches AiTranslateError and just leaves the *En fields
// null rather than failing the save, same "AI enrichment never blocks the
// core action" posture as businessKycService/subtitleService.
export async function translateTitleAndDescription(title: string, description: string): Promise<TranslateTitleAndDescriptionResult> {
  const prompt = `Translate the following Georgian title and description into natural, fluent English. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "descriptionEn": string}

title: ${title}
description: ${description}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = titleDescriptionTranslationSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }
  return result.data;
}

// Convenience wrapper around translateTitleAndDescription for the automatic
// (not button-triggered) callers — routes/products.ts, routes/
// adminProducts.ts, routes/tutorials.ts. Handles every "don't bother"
// case itself (already filled in, Gemini not configured, translation
// failed) so those routes just call this once and merge the result,
// rather than each re-implementing the same best-effort try/catch.
// logContext is just for the console.error prefix, e.g. "products".
export async function autoTranslateIfBlank(
  title: string,
  description: string,
  existingTitleEn: string | null | undefined,
  existingDescriptionEn: string | null | undefined,
  logContext: string
): Promise<{ titleEn: string | null | undefined; descriptionEn: string | null | undefined }> {
  if (existingTitleEn && existingDescriptionEn) {
    return { titleEn: existingTitleEn, descriptionEn: existingDescriptionEn };
  }
  if (!isAiTranslateConfigured()) {
    return { titleEn: existingTitleEn, descriptionEn: existingDescriptionEn };
  }
  try {
    const translated = await translateTitleAndDescription(title, description);
    return {
      titleEn: existingTitleEn || translated.titleEn,
      descriptionEn: existingDescriptionEn || translated.descriptionEn,
    };
  } catch (err) {
    console.error(`[${logContext}] auto-translate failed:`, err instanceof Error ? err.message : err);
    return { titleEn: existingTitleEn, descriptionEn: existingDescriptionEn };
  }
}

// --- Course / curriculum translation ---
//
// Unlike the three functions above (which always translate one fixed set of
// fields), this one's input is itself all-optional — it's reused by two
// different callers: the course-level "Auto-Translate to English" button in
// admin/courses.tsx's CourseForm (sends title/description, no sections), and
// the per-section "Translate" action in CurriculumEditor's SectionCard
// (sends one section + its lessons, no top-level title/description). The
// response mirrors whichever of those was actually provided, so a caller
// never has to interpret an EN field it didn't ask to translate.

export interface TranslateCourseLessonInput {
  title: string;
  assignmentPrompt?: string;
}

export interface TranslateCourseSectionInput {
  title: string;
  lessons?: TranslateCourseLessonInput[];
}

export interface TranslateCourseParams {
  title?: string;
  description?: string;
  sections?: TranslateCourseSectionInput[];
}

const courseLessonTranslationSchema = z.object({
  titleEn: z.string(),
  assignmentPromptEn: z.string().optional(),
});

const courseSectionTranslationSchema = z.object({
  titleEn: z.string(),
  lessons: z.array(courseLessonTranslationSchema).optional(),
});

const courseTranslationResponseSchema = z.object({
  titleEn: z.string().optional(),
  descriptionEn: z.string().optional(),
  sections: z.array(courseSectionTranslationSchema).optional(),
});

export type TranslateCourseResult = z.infer<typeof courseTranslationResponseSchema>;

// The "startup pitching and VC education platform" framing and the specific
// acronym list (TAM/SAM/SOM/CAC/LTV/MRR/Churn/UVP/Moat/GTM/B2B/SaaS) come
// straight from how this button was specified — kept close to that wording
// rather than genericized, since it's a real stylistic choice for how CDC's
// business-oriented course content should read in English, not an
// arbitrary detail to simplify away.
export async function translateCourse(params: TranslateCourseParams): Promise<TranslateCourseResult> {
  if (!params.title && !params.description && !params.sections?.length) {
    throw new AiTranslateError('Nothing to translate — provide a title, description, or sections.');
  }

  const inputParts: string[] = [];
  if (params.title) inputParts.push(`title: ${params.title}`);
  if (params.description) inputParts.push(`description: ${params.description}`);
  if (params.sections?.length) inputParts.push(`sections: ${JSON.stringify(params.sections)}`);

  const prompt = `You are an expert Business English translator for startup pitching and VC education platforms. Translate the input course content from Georgian to fluent, modern Business English. Preserve all Markdown formatting, structure, HTML tags, and domain-specific acronyms (TAM, SAM, SOM, CAC, LTV, MRR, Churn, UVP, Moat, GTM, B2B, SaaS) exactly as written — never translate or expand them. Respond with strict JSON containing ONLY the keys corresponding to what was provided below (omit any key whose source field is absent), using this shape:
{"titleEn"?: string, "descriptionEn"?: string, "sections"?: [{"titleEn": string, "lessons"?: [{"titleEn": string, "assignmentPromptEn"?: string}]}]}

Preserve the exact order and count of sections and lessons from the input — one output section/lesson per input section/lesson.

${inputParts.join('\n')}`;

  const raw = await generateTranslationJson(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiTranslateError('Gemini returned malformed JSON.');
  }

  const result = courseTranslationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiTranslateError('Gemini returned an unexpected translation format.');
  }

  return result.data;
}
