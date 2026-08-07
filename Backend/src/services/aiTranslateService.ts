import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';

export function isAiTranslateConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export class AiTranslateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiTranslateError';
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
  if (!client) {
    throw new AiTranslateError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `Translate the following Georgian blog post fields into natural, fluent English. Preserve meaning, tone, and any Markdown formatting in the content field — do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "descriptionEn": string, "contentEn": string}

title: ${params.title}
description: ${params.description}
content: ${params.content}`;

  const model = client.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  });

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new AiTranslateError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new AiTranslateError('Gemini returned an empty response.');

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
  if (!client) {
    throw new AiTranslateError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `Translate the following Georgian CDC Studio portfolio case study fields into natural, fluent English. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "descriptionEn": string, "fullStoryEn": string}

title: ${params.title}
description: ${params.description}
fullStory: ${params.fullStory}`;

  const model = client.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  });

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new AiTranslateError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new AiTranslateError('Gemini returned an empty response.');

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
  if (!client) {
    throw new AiTranslateError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `Translate the following Georgian mentor profile fields into natural, fluent English, suitable for a public mentor-directory listing. Preserve meaning and tone; do not summarize or shorten. Respond with strict JSON matching this shape:
{"titleEn": string, "bioEn": string}

title: ${params.title}
bio: ${params.bio}`;

  const model = client.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  });

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new AiTranslateError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new AiTranslateError('Gemini returned an empty response.');

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
