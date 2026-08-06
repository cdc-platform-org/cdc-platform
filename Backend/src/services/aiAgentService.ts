import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';
import { uploadImage } from './imageStorage';

// ============================================================
// CDC AUTONOMOUS OPERATIONS AGENT — central AI service wrapper.
//
// Every operational module (blog drafting today; the weekly admin digest
// and onboarding emails scaffolded below) goes through this file rather
// than constructing its own client, so the model names/config live in
// exactly one place. Text generation is Gemini (same "flash only, 501
// until configured" shape as services/aiExamService.ts,
// services/aiTranslateService.ts and services/subtitleService.ts). Cover
// images are Pollinations.ai (see generateCoverImage()) — unauthenticated
// and free, deliberately NOT Gemini/Imagen, which needs Cloud Billing
// enabled for any image model on this Google Cloud project.
// ============================================================

export function isAiAgentConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// "gemini-2.5-pro"/"gemini-pro-latest" return a hard 0 free-tier quota on
// this account (see aiExamService.ts) — same reasoning applies here, so
// text generation stays on the Flash family.
const TEXT_MODEL = 'gemini-flash-latest';

// Cover images go through Pollinations.ai instead of Gemini/Imagen — Imagen
// (3 or 4) was evaluated first and rejected: Imagen 3 no longer appears in
// this Google Cloud project's ListModels response at all (superseded),
// imagen-4.0-generate-001 returns a hard 404 "no longer available to new
// users" regardless of API key, and the Gemini-native image models
// (gemini-3-pro-image etc.) are gated behind a 0-quota free tier that
// requires enabling Cloud Billing (confirmed live on 2026-08-06). Pollinations
// needs no API key/billing at all — image.pollinations.ai/prompt/<prompt> is
// a plain unauthenticated GET that returns image bytes directly.
const POLLINATIONS_IMAGE_ENDPOINT = 'https://image.pollinations.ai/prompt';
// Pollinations can take a while to render — generous but bounded so a slow/
// stuck request surfaces as a null cover (never blocks the text draft)
// instead of hanging the request indefinitely.
const IMAGE_GENERATION_TIMEOUT_MS = 60_000;

export class AiAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAgentError';
  }
}

async function callTextModel(prompt: string, temperature: number): Promise<string> {
  if (!client) throw new AiAgentError('Gemini is not configured (GEMINI_API_KEY missing).');
  let raw: string;
  try {
    const model = client.getGenerativeModel({
      model: TEXT_MODEL,
      generationConfig: { responseMimeType: 'application/json', temperature },
    });
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new AiAgentError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new AiAgentError('Gemini returned an empty response.');
  return raw;
}

// ============================================================
// MODULE 1 — Blog & Image Generator
// ============================================================

const blogDraftSchema = z.object({
  titleKa: z.string().min(3),
  titleEn: z.string().min(3),
  category: z.string().min(2),
  descriptionKa: z.string().min(10),
  descriptionEn: z.string().min(10),
  contentKa: z.string().min(50),
  contentEn: z.string().min(50),
  // A short, concrete visual concept for the cover — NOT the final image
  // prompt. generateCoverImage() wraps this with the mandatory style/
  // aspect-ratio/negative-constraint rules so every image call gets them,
  // rather than trusting the article-writing prompt to remember them too.
  imageConcept: z.string().min(5),
});

export interface BlogDraft {
  title: string;
  description: string;
  content: string;
  category: string;
  titleEn: string;
  descriptionEn: string;
  contentEn: string;
  imageConcept: string;
}

// Bilingual (KA primary / EN twin) blog draft — title, category, short
// excerpt, and a full article body, focused on current AI & tech trends
// unless `topic` narrows it. Used by both the manual "✨ Generate" button
// (admin/blog) and the twice-weekly cron draft.
export async function generateBlogDraft(topic?: string): Promise<BlogDraft> {
  const topicLine = topic?.trim()
    ? `Write specifically about: ${topic.trim()}`
    : 'Choose one specific, current, non-generic topic in AI & technology (a real recent development, tool, technique, or industry shift) — avoid vague "AI is changing everything" filler. Prefer topics relevant to a Georgian audience of students/freelancers/tech professionals where reasonable.';

  const prompt = `You are the content strategist for CDC (cdc.org.ge), a Georgian digital-careers/education platform. Write one blog article for their site.

${topicLine}

Requirements:
- Write BOTH a Georgian (ქართული) version and an English version of the same article — not a literal translation of each other, but both should cover the same content, facts, and structure. Keep standard IT/tech terminology in English even in the Georgian text where that's natural (e.g. "API", "SEO", "framework").
- "category" is a single short Georgian category label (2-4 words), e.g. "ტექნოლოგიები" or "ხელოვნური ინტელექტი".
- "contentKa"/"contentEn" are the full article body as HTML (use <p>, <h2>, <h3>, <ul>/<li>, <strong> — no <html>/<body> wrapper), at least 4-6 paragraphs, genuinely informative, not filler.
- Every article MUST end with a sources section as its final <h2>: use exactly "<h2>წყაროები</h2>" in contentKa and "<h2>Sources</h2>" in contentEn, immediately followed by a <ul> of 2-4 <li><a href="..." target="_blank" rel="noopener noreferrer">...</a></li> entries. Only cite well-known, stable, real URLs you are highly confident exist (official documentation, an official product/GitHub page, a well-established technical reference) — never invent or guess a URL. If you cannot recall a specific real source confidently, link to the general official docs/homepage of the technology discussed instead of fabricating a deep link.
- "descriptionKa"/"descriptionEn" are a 1-2 sentence excerpt (under 200 characters) suitable for a blog list preview.
- "imageConcept" is a short (1-2 sentence) description of a concrete visual scene for the cover image — describe objects/composition/mood, not style keywords (style is handled separately).

Respond with strict JSON matching this shape:
{"titleKa": string, "titleEn": string, "category": string, "descriptionKa": string, "descriptionEn": string, "contentKa": string, "contentEn": string, "imageConcept": string}`;

  const raw = await callTextModel(prompt, 0.8);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiAgentError('Gemini returned malformed JSON.');
  }

  const result = blogDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiAgentError('Gemini returned an unexpected blog draft format.');
  }

  return {
    title: result.data.titleKa,
    description: result.data.descriptionKa,
    content: result.data.contentKa,
    category: result.data.category,
    titleEn: result.data.titleEn,
    descriptionEn: result.data.descriptionEn,
    contentEn: result.data.contentEn,
    imageConcept: result.data.imageConcept,
  };
}

// Every image generation call in this file — present or future — goes
// through this one function, so the mandatory style/aspect-ratio/negative-
// constraint rules are applied exactly once, centrally, rather than being
// copy-pasted (and potentially drifting) at every call site.
function buildImagePrompt(concept: string): string {
  return `${concept}, modern 3D vector illustration, vibrant tech artwork, clean digital vector aesthetic, isometric or abstract technology concept, 16:9 widescreen, highly detailed, stunning visual art, strictly no text, no typography, no watermarks, no logos`;
}

// Generates a cover image from a short visual concept via Pollinations.ai
// (image.pollinations.ai/prompt/<prompt> — unauthenticated, no API
// key/billing) and uploads it to Bunny Storage (via the shared
// imageStorage.uploadImage — same helper the admin's manual blog-cover
// upload uses), returning the public URL.
//
// Returns null (never throws) on any failure — a missing cover image must
// never block or fail an otherwise-good text draft; the admin can always
// attach one manually via the existing upload button.
export async function generateCoverImage(concept: string, folderName = 'blog'): Promise<string | null> {
  try {
    // A fresh random seed per call — reusing a seed (or issuing a HEAD
    // request first) can return a cached empty body from Pollinations' edge
    // cache, confirmed live on 2026-08-06.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = `${POLLINATIONS_IMAGE_ENDPOINT}/${encodeURIComponent(buildImagePrompt(concept))}?width=1280&height=720&seed=${seed}&nologo=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_GENERATION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.warn(`[aiAgentService] Cover image generation failed (${response.status}).`);
      return null;
    }

    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;

    const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const filename = `ai-cover-${Date.now()}-${crypto.randomUUID()}.${ext}`;

    return await uploadImage({ buffer, mimetype: mimeType, folderName, filename });
  } catch (err) {
    console.warn('[aiAgentService] Cover image generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================
// MODULE 2 (scaffold) — Weekly Admin Analytics Digest
//
// Not wired to any schedule/route yet — this is the callable building
// block a future cron/admin-panel trigger will call. Takes whatever
// metrics the caller has already computed (this file stays Prisma-free —
// see the aiAgentService.ts file comment) and returns a written summary.
// ============================================================

export interface WeeklyAdminDigestMetrics {
  periodLabel: string; // e.g. "Jul 28 – Aug 3, 2026"
  newUsers: number;
  newEnrollments: number;
  revenueMinorUnits: number; // tetri
  currency: string; // e.g. "GEL"
  openDisputes: number;
  pendingPayouts: number;
  topCourses: { title: string; enrollments: number }[];
  notableEvents?: string[]; // free-text bullets the caller wants surfaced
}

export interface WeeklyAdminDigest {
  subject: string;
  bodyHtml: string;
}

const digestSchema = z.object({ subject: z.string().min(3), bodyHtml: z.string().min(20) });

export async function generateWeeklyAdminDigest(metrics: WeeklyAdminDigestMetrics): Promise<WeeklyAdminDigest> {
  const prompt = `You are writing a short weekly internal digest email for the admin team of CDC (cdc.org.ge), a Georgian digital-careers/education platform. Summarize the week's numbers below into a concise, professional email in English.

Period: ${metrics.periodLabel}
New users: ${metrics.newUsers}
New course enrollments: ${metrics.newEnrollments}
Revenue: ${(metrics.revenueMinorUnits / 100).toFixed(2)} ${metrics.currency}
Open disputes: ${metrics.openDisputes}
Pending payouts: ${metrics.pendingPayouts}
Top courses: ${metrics.topCourses.map((c) => `${c.title} (${c.enrollments} enrollments)`).join(', ') || 'none'}
${metrics.notableEvents?.length ? `Notable events: ${metrics.notableEvents.join('; ')}` : ''}

Write a short subject line and an HTML email body (<p>, <ul>/<li>, <strong> only — no <html>/<body> wrapper) that highlights what matters, flags anything that needs attention (open disputes, pending payouts), and stays under ~200 words. Respond with strict JSON matching this shape:
{"subject": string, "bodyHtml": string}`;

  const raw = await callTextModel(prompt, 0.5);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiAgentError('Gemini returned malformed JSON.');
  }
  const result = digestSchema.safeParse(parsed);
  if (!result.success) throw new AiAgentError('Gemini returned an unexpected digest format.');
  return result.data;
}

// ============================================================
// MODULE 3 (scaffold) — Onboarding Email Content (day 3 / 7 / 14)
//
// Same status as Module 2: a callable helper, not wired to any trigger.
// A future scheduled job would query users by days-since-signup and call
// this per user/day to get the email content, then hand it to the existing
// services/emailService.ts (Resend) to actually send.
// ============================================================

export type OnboardingDay = 3 | 7 | 14;

export interface OnboardingEmailContext {
  name: string;
  role: 'Student' | 'Client';
  lang: 'ka' | 'en';
}

export interface OnboardingEmailContent {
  subject: string;
  bodyHtml: string;
}

const onboardingSchema = z.object({ subject: z.string().min(3), bodyHtml: z.string().min(20) });

const ONBOARDING_DAY_GOAL: Record<OnboardingDay, string> = {
  3: 'Encourage them to complete their profile and start (or continue) their first course/tool, in a warm, low-pressure tone.',
  7: 'Highlight one concrete platform feature they likely haven\'t used yet (based on their role) and nudge them toward it.',
  14: 'Check in on progress, share a success-story angle, and invite feedback — this is the last scheduled onboarding touch.',
};

export async function generateOnboardingEmailContent(
  day: OnboardingDay,
  context: OnboardingEmailContext
): Promise<OnboardingEmailContent> {
  const languageLine =
    context.lang === 'ka'
      ? 'Write the subject and body in Georgian (ქართული).'
      : 'Write the subject and body in English.';
  const roleLine =
    context.role === 'Client'
      ? 'They are a Business account (an employer/company using CDC to hire, post gigs, or access Enterprise AI tools).'
      : 'They are a Student/Freelancer account (using CDC to learn, take courses, and find freelance work).';

  const prompt = `You are writing a day-${day} onboarding email for a new user of CDC (cdc.org.ge), a Georgian digital-careers/education platform. The user's name is "${context.name}". ${roleLine}

Goal for this email: ${ONBOARDING_DAY_GOAL[day]}
${languageLine}

Write a short, friendly subject line and an HTML email body (<p>, <strong> only — no <html>/<body> wrapper, no more than 3 short paragraphs). Do not fabricate specific course names, prices, or features that may not exist — keep it general and platform-appropriate. Respond with strict JSON matching this shape:
{"subject": string, "bodyHtml": string}`;

  const raw = await callTextModel(prompt, 0.6);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiAgentError('Gemini returned malformed JSON.');
  }
  const result = onboardingSchema.safeParse(parsed);
  if (!result.success) throw new AiAgentError('Gemini returned an unexpected onboarding email format.');
  return result.data;
}
