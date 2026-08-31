import { azureOpenai } from "../utils/azureOpenai";
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';
import { uploadImage } from './imageStorage';
import { isAzureOpenAiConfigured, generateJsonViaAzureOpenAI, isAzureOpenAiDalleConfigured, generateImageViaDallE3 } from './azureOpenAiService';

// ============================================================
// CDC AUTONOMOUS OPERATIONS AGENT — central AI service wrapper.
//
// Every operational module (blog drafting today; the weekly admin digest
// and onboarding emails scaffolded below) goes through this file rather
// than constructing its own client, so the model names/config live in
// exactly one place. Text generation is Gemini (same "flash only, 501
// until configured" shape as services/aiExamService.ts,
// services/aiTranslateService.ts and services/subtitleService.ts). Cover
// images try DALL-E 3 (Azure OpenAI) first when configured, falling back
// to Pollinations.ai (unauthenticated and free — deliberately NOT Gemini/
// Imagen, which needs Cloud Billing enabled for any image model on this
// Google Cloud project) — see generateCoverImage()'s own comment for the
// full chain. Same "best available paid option first, always-available
// free option second" shape as the Gemini→Azure OpenAI text chain above,
// applied to images instead of text.
// ============================================================

export function isAiAgentConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? azureOpenai : null;

// "gemini-2.5-pro"/"gemini-pro-latest" return a hard 0 free-tier quota on
// this account (see aiExamService.ts) — same reasoning applies here, so
// text generation stays on the Flash family. gemini-flash-latest is tried
// first (fastest, usual default); the other two are only reached when it's
// actively overloaded (503/429 — see isRetryableGeminiError), since a
// different model answering is far better than the admin seeing a raw error
// and having to click Generate again themselves. All three confirmed live
// via direct ListModels + generateContent probes against this project's API
// key on 2026-08-17 — gemini-1.5-flash/gemini-1.5-pro and gemini-2.5-flash
// (and its -lite variant) all now 404 ("no longer available to new users").
const TEXT_MODEL_FALLBACK_SEQUENCE = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const RETRY_DELAY_MS = 1500;
const ATTEMPTS_PER_MODEL = 2;

// The Gemini SDK doesn't expose a structured status code — API errors come
// back as an Error whose .message embeds Google's REST status, e.g.
// "[503 Service Unavailable] The model is overloaded..." or "[429 Too Many
// Requests] Resource has been exhausted...". Matched defensively since the
// SDK gives no guarantee on this exact format across versions. A non-match
// (e.g. a malformed-prompt 400) fails immediately rather than burning
// through the whole model/retry sequence for an error no retry can fix.
function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(503|429)\b/.test(message) || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

// Maps a Gemini failure to the HTTP status a route should actually respond
// with — 429 for quota/rate-limit exhaustion (the caller should slow down
// or try again later, same meaning as this app's own rate-limit middleware
// returning 429), 503 for "temporarily overloaded" (retry shortly, not the
// caller's fault), 502 for anything else (a genuine upstream failure).
function classifyGeminiErrorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b429\b/.test(message) || /RESOURCE_EXHAUSTED|quota/i.test(message)) return 429;
  if (/\b503\b/.test(message) || /UNAVAILABLE|overloaded|high demand/i.test(message)) return 503;
  return 502;
}

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
// DALL-E 3 at `quality: 'hd'` is slower than Pollinations' Flux model —
// bounded longer for the same "never hang, just fall through" reason, not
// because a slow response is expected to be the norm.
const DALLE_TIMEOUT_MS = 90_000;

export class AiAgentError extends Error {
  // HTTP status a route should respond with — see classifyGeminiErrorStatus.
  // Defaults to 502 for callers that construct this directly (malformed
  // response, missing API key, etc.) rather than via the classifier.
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'AiAgentError';
    this.status = status;
  }
}

export interface InlineImagePart {
  mimeType: string;
  data: string; // base64
}

// A Gemini File API reference (see subtitleService.ts's uploadAudioAndWaitActive)
// — distinct from InlineImagePart, which is base64 bytes inlined into the
// request. A File API upload is how audio (and anything too large to inline)
// gets into a generateContent call.
export interface GeminiFileRef {
  // Optional — omitted for a YouTube URL fileUri. Gemini's file_data.mime_type
  // is only meaningful for a File API upload reference (audio/video bytes);
  // a public YouTube watch/shorts URL is recognized by Gemini's own video-
  // understanding feature purely from the fileUri shape (see
  // mediaStudioService.ts), and sending a mimeType alongside one is not part
  // of that documented contract, so it's left out rather than guessed at.
  mimeType?: string;
  fileUri: string;
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } } | { fileData: { mimeType?: string; fileUri: string } };

// Shared by callTextModel/callTextModelPlain below — runs the same
// gemini-flash-latest -> gemini-flash-lite-latest -> gemini-3.5-flash
// retry sequence (2 attempts each on a retryable 503/429) so this behavior
// lives in exactly one place regardless of which response mode a caller
// needs. Returns null (not a throw) when every model failed, so each public
// function above can decide its own fallback/error behavior — this helper
// doesn't know about Azure OpenAI or AiAgentError construction.
async function runGeminiFallbackSequence(
  parts: GeminiPart[],
  temperature: number,
  responseMimeType: 'application/json' | 'text/plain'
): Promise<{ raw: string; lastError: null } | { raw: null; lastError: unknown }> {
  let lastError: unknown;
  for (const modelName of TEXT_MODEL_FALLBACK_SEQUENCE) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const model = client!.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType, temperature },
        }, GEMINI_REQUEST_OPTIONS);
        // The installed SDK's own FileData type requires mimeType: string
        // (no optional variant) — stricter than the actual REST contract,
        // which treats it as optional (confirmed live: a YouTube fileUri
        // with mime_type omitted is accepted and processed correctly). Cast
        // narrowly here rather than loosening GeminiPart's public shape.
        const result = await model.generateContent(parts as any);
        const raw = result.response.text();
        if (!raw) throw new AiAgentError('Gemini returned an empty response.');
        return { raw, lastError: null };
      } catch (err) {
        lastError = err;
        console.error(`[aiAgentService] ${modelName} attempt ${attempt}/${ATTEMPTS_PER_MODEL} failed:`, err instanceof Error ? err.message : err);
        if (!isRetryableGeminiError(err)) return { raw: null, lastError };
        if (attempt < ATTEMPTS_PER_MODEL) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
      // Retries exhausted for this model (still 503/429) — try the next
      // model in the sequence immediately, no added delay (a different
      // model has its own capacity, so there's nothing to wait out here).
    }
  }
  return { raw: null, lastError };
}

function throwGeminiFailure(lastError: unknown): never {
  Sentry.captureException(lastError);
  throw lastError instanceof AiAgentError
    ? lastError
    : new AiAgentError(
        lastError instanceof Error ? `Gemini request failed: ${lastError.message}` : 'Gemini request failed.',
        classifyGeminiErrorStatus(lastError)
      );
}

// Exported for other operational modules that need raw Gemini JSON output
// but don't fit this file's existing MODULE N shape (currently
// productModerationService.ts) — keeps the "exactly one place" model/retry
// config promise from the file comment above even for those. `imageParts` is
// optional inline (base64) image data for vision-capable calls — every
// model in TEXT_MODEL_FALLBACK_SEQUENCE is a Gemini multimodal model, so no
// separate vision-only model list is needed.
export async function callTextModel(prompt: string, temperature: number, imageParts?: InlineImagePart[]): Promise<string> {
  // Cross-vendor fallback (see azureOpenAiService.ts) only covers the
  // text-only path — GPT-4o supports vision too, but wiring inline image
  // parts into an OpenAI-shaped message is a separate piece of work with no
  // caller here yet, so it's an explicit scope boundary, not a silent gap.
  const canUseAzureFallback = !imageParts || imageParts.length === 0;

  if (!client) {
    if (canUseAzureFallback && isAzureOpenAiConfigured()) return (await generateJsonViaAzureOpenAI(prompt, temperature)).raw;
    throw new AiAgentError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const parts: GeminiPart[] = [{ text: prompt }, ...(imageParts ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))];

  const geminiResult = await runGeminiFallbackSequence(parts, temperature, 'application/json');
  if (geminiResult.raw !== null) return geminiResult.raw;
  let lastError = geminiResult.lastError;

  // Every Gemini model failed — same cross-vendor 4th rung as
  // examProctoringService.ts's generateJson(), same reasoning for why it's
  // last rather than first. No-op when AZURE_OPENAI_* isn't configured.
  if (canUseAzureFallback && isAzureOpenAiConfigured()) {
    try {
      return (await generateJsonViaAzureOpenAI(prompt, temperature)).raw;
    } catch (azureErr) {
      console.error('[aiAgentService] Azure OpenAI fallback also failed:', azureErr instanceof Error ? azureErr.message : azureErr);
      lastError = azureErr;
    }
  }

  // Same reasoning as examProctoringService.ts's identical capture point —
  // callers of callTextModel() catch this and respond directly, so it never
  // reaches Sentry.setupExpressErrorHandler in server.ts on its own.
  throwGeminiFailure(lastError);
}

// Plain-text sibling of callTextModel() — for callers whose output is NOT
// JSON (WebVTT, markdown prose, ...), where forcing
// responseMimeType: 'application/json' would corrupt the response. Same
// 3-model Gemini retry sequence; deliberately NO Azure OpenAI fallback rung
// — generateJsonViaAzureOpenAI is JSON-only, and building a plain-text Azure
// completion path has no caller yet, so (like callTextModel's own
// imageParts/Azure boundary above) this is an explicit scope boundary, not
// an oversight. `fileRef` is a Gemini File API reference (audio, or anything
// too large to inline — see GeminiFileRef) for multimodal calls that read an
// uploaded file rather than inline bytes.
export async function callTextModelPlain(prompt: string, temperature: number, fileRef?: GeminiFileRef): Promise<string> {
  if (!client) {
    throw new AiAgentError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const parts: GeminiPart[] = fileRef
    ? [
        { fileData: fileRef.mimeType ? { mimeType: fileRef.mimeType, fileUri: fileRef.fileUri } : { fileUri: fileRef.fileUri } },
        { text: prompt },
      ]
    : [{ text: prompt }];

  const geminiResult = await runGeminiFallbackSequence(parts, temperature, 'text/plain');
  if (geminiResult.raw !== null) return geminiResult.raw;
  throwGeminiFailure(geminiResult.lastError);
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

// Gemini returns contentKa/contentEn as one continuous HTML string with no
// whitespace between tags (e.g. "<h2>Foo</h2><p>Bar</p>") — valid HTML, but
// unreadable as a single run-on line in the admin's RichTextEditor (a plain
// <textarea>, no HTML awareness). Inserting a newline at every tag boundary
// puts each element on its own line for editing; the extra whitespace
// between block-level tags has no visual effect once actually rendered as
// HTML (browsers collapse it), so this only affects the raw-source view.
function prettyPrintHtml(html: string): string {
  return html.replace(/></g, '>\n<').trim();
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
- "contentKa"/"contentEn" are the full article body as clean, structured HTML — no <html>/<body> wrapper, ready to be inserted directly into a page and rendered as-is. Follow this structure strictly:
  * Open with 1-2 short <p> paragraphs (2-4 sentences each) that hook the reader — no heading before this intro.
  * Break the rest of the body into 3-5 sections, each starting with an <h2> (use <h3> for a sub-point inside a section only if genuinely needed). Section headings must be specific and scannable, never generic ("Introduction", "Conclusion").
  * Keep every <p> short and well-spaced — 2-4 sentences, one idea each. Never write a wall-of-text paragraph.
  * Use <strong> to bold crucial terms, numbers, and key phrases inline within paragraphs — enough that a reader skimming only the bolded words gets the gist, but never bold entire sentences.
  * Include at least one <ul> of 3-5 <li> bullet points somewhere in the body for a scannable "key takeaways" or list-style moment (e.g. steps, benefits, comparison points) — do not force it if the topic has no natural list, but most topics do.
  * Include exactly one <blockquote> containing a single punchy, quotable sentence — a key takeaway, a striking stat, or the article's core insight — placed after the section it summarizes, not at the very top or bottom.
  * Overall length: at least 4-6 substantial sections' worth of content, genuinely informative and specific to the topic, never generic filler.
- Every article MUST end with a sources section as its final <h2>: use exactly "<h2>წყაროები</h2>" in contentKa and "<h2>Sources</h2>" in contentEn, immediately followed by a <ul> of 2-4 <li><a href="..." target="_blank" rel="noopener noreferrer">...</a></li> entries. Only cite well-known, stable, real URLs you are highly confident exist (official documentation, an official product/GitHub page, a well-established technical reference) — never invent or guess a URL. If you cannot recall a specific real source confidently, link to the general official docs/homepage of the technology discussed instead of fabricating a deep link.
- "descriptionKa"/"descriptionEn" are a 1-2 sentence excerpt (under 200 characters) suitable for a blog list preview.
- "imageConcept" is a short (1-2 sentence) description of what's ON SCREEN in the cover photo — describe the concrete, topic-specific subject matter, not style keywords (style/lighting/composition are handled separately). Name the actual technology/framework/tool the article is about and what a viewer would recognize on the screen: e.g. for "React 19", describe a code editor or UI mockup showing React component code with a floating React logo icon nearby; for "AI Automation", describe a dashboard UI with connected workflow/pipeline nodes and an AI icon. Avoid vague scenes ("a laptop with some code") in favor of ones a reader would immediately connect to the article's actual subject.

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
    content: prettyPrintHtml(result.data.contentKa),
    category: result.data.category,
    titleEn: result.data.titleEn,
    descriptionEn: result.data.descriptionEn,
    contentEn: prettyPrintHtml(result.data.contentEn),
    imageConcept: result.data.imageConcept,
  };
}

// Every image generation call in this file — present or future — goes
// through this one function, so the mandatory style/aspect-ratio/negative-
// constraint rules are applied exactly once, centrally, rather than being
// copy-pasted (and potentially drifting) at every call site.
//
// Structured as a "tech product showcase" composition (subject/environment,
// graphic overlay, lighting/style, negative constraints) rather than a flat
// keyword bag — `concept` (Gemini's topic-specific imageConcept, e.g. "a
// code editor showing React 19 component code with a floating React logo")
// slots into the Subject & Environment clause, so the topic keywords a
// reader would recognize stay concrete instead of getting diluted by the
// style boilerplate around them.
function buildImagePrompt(concept: string): string {
  const subjectAndEnvironment = `${concept}, displayed on a premium sleek laptop or monitor screen in a cozy dark modern office, soft ambient cinematic lighting, shallow depth of field, subtle background bokeh`;
  const graphicOverlay = `high-definition 3D floating glassmorphism tech icons relevant to the subject arranged around the screen, crisp clean typography accents, sleek modern logo-style accents along the side — no random unrelated icons`;
  const lightingAndStyle = `photorealistic 8k render, cinematic studio lighting, dark mode UI theme in slate/indigo/cyan tones with a subtle glow, professional tech product advertisement style, official Anthropic/OpenAI-style marketing visual quality`;
  const aspectRatio = `strictly 16:9 widescreen aspect ratio, 1920x1080`;
  const negative = `no messy abstract shapes, no distorted or illegible text, no generic cartoonish clip-art, no low-resolution gradients, no random floating glowing spheres, no watermarks`;

  return `${subjectAndEnvironment}. ${graphicOverlay}. ${lightingAndStyle}. ${aspectRatio}. Avoid: ${negative}.`;
}

// The platform's fixed visual-identity signature for AI-generated blog
// covers — injected verbatim into every DALL-E 3 request alongside the
// topic-specific concept, so every AI-drafted post's cover matches the
// same "high-end SaaS product" look regardless of what the article is
// about. Deliberately a stable, literal string (not assembled from
// clauses like buildImagePrompt above) — this exact wording is the
// platform's agreed style guide, not a first draft to keep tuning.
const DALLE_STYLE_SIGNATURE =
  'High-end 3D SaaS/AI product landscape banner, dark mode interface mockup, glowing neon purple and cyan accents, sleek glassmorphism dashboard, developer tool aesthetic, clean composition, 16:9 aspect ratio, 8k render.';

function buildDallePrompt(concept: string): string {
  return `${concept}. ${DALLE_STYLE_SIGNATURE}`;
}

// Tries DALL-E 3 (Azure OpenAI) first — see azureOpenAiService.generateImageViaDallE3's
// own comment for why it requests raw bytes rather than a URL. Returns
// null (never throws) so the Pollinations fallback below always gets a
// chance to run instead of the whole draft failing outright.
async function generateCoverImageViaDallE3(concept: string, folderName: string): Promise<string | null> {
  try {
    const { buffer, mimeType } = await generateImageViaDallE3(buildDallePrompt(concept), DALLE_TIMEOUT_MS);
    if (buffer.length === 0) return null;
    const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
    const filename = `ai-cover-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    return await uploadImage({ buffer, mimetype: mimeType, folderName, filename });
  } catch (err) {
    console.warn('[aiAgentService] DALL-E 3 cover image generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
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
async function generateCoverImageViaPollinations(concept: string, folderName: string): Promise<string | null> {
  try {
    // A fresh random seed per call — reusing a seed (or issuing a HEAD
    // request first) can return a cached empty body from Pollinations' edge
    // cache, confirmed live on 2026-08-06.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    // model=flux — Pollinations' sharpest general-purpose model, a real
    // (if less controllable than a paid API) step up from its default
    // Turbo model for this "tech product showcase" style. 1920x1080 (vs.
    // the previous 1280x720) is the highest resolution Pollinations
    // reliably renders at without timing out.
    const url = `${POLLINATIONS_IMAGE_ENDPOINT}/${encodeURIComponent(buildImagePrompt(concept))}?width=1920&height=1080&model=flux&seed=${seed}&nologo=true`;

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

// Public entry point every caller (blogAgentService.ts today) uses — tries
// DALL-E 3 first when an image deployment is actually configured, falling
// back to Pollinations either when it isn't, or when the DALL-E 3 attempt
// itself failed/timed out. Either branch already returns null (never
// throws) on its own failure, so this function can never throw either —
// the worst case is BlogPost.imageUrl stays null and the post renders
// with the platform's default gradient placeholder (see Frontend's
// pages/blog/index.tsx), exactly as if no cover had been requested at
// all. A missing/failed cover must never block blog creation.
export async function generateCoverImage(concept: string, folderName = 'blog'): Promise<string | null> {
  if (isAzureOpenAiDalleConfigured()) {
    const dalleResult = await generateCoverImageViaDallE3(concept, folderName);
    if (dalleResult) return dalleResult;
  }
  return generateCoverImageViaPollinations(concept, folderName);
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

// ============================================================
// MODULE 4 — Business AI Agents Suite (Frontend's /dashboard/ai-tools).
// Three prompt-in/response-out tools gated behind the account's AI trial/
// subscription — see utils/aiAgentsSuiteAccess.ts and
// routes/aiAgentsSuite.ts. Distinct from the pre-existing embeddable
// customer-facing chatbot (the Agent Prisma model, services/... none —
// see routes/agents.ts): these are internal tools the business owner uses
// directly, not something they embed on their own external site.
// ============================================================

export type AiAgentSuiteTool = 'content' | 'analytics' | 'assistant';

const AI_AGENT_SUITE_SYSTEM_PROMPT: Record<AiAgentSuiteTool, string> = {
  content:
    'You are a B2B marketing/content generation assistant for a business account on CDC (cdc.org.ge), a Georgian digital-careers platform. Help the business write marketing copy, social media posts, product descriptions, or outreach messages based on their request. Output should be concise, professional, and copy-paste-ready content — not advice about how to write it.',
  analytics:
    "You are a market/industry research and analysis assistant for a business account on CDC. Given the business's question, provide a well-reasoned analysis of market trends, competitive positioning, industry context, or business strategy. You do NOT have access to the business's real sales/analytics data — clearly note when you're giving general industry reasoning rather than citing specific real-time data, and never fabricate specific statistics, sources, or company names you aren't confident about.",
  assistant:
    'You are a general business assistant for a business account on CDC — help with day-to-day business questions: drafting emails, summarizing ideas, brainstorming, and general business/management/HR/operations questions. Be practical and actionable.',
};

const aiAgentSuiteResponseSchema = z.object({ response: z.string().min(1) });

export async function generateAiAgentSuiteResponse(tool: AiAgentSuiteTool, userPrompt: string, lang: 'ka' | 'en'): Promise<string> {
  const languageLine = lang === 'ka' ? 'Respond in Georgian (ქართული).' : 'Respond in English.';
  const prompt = `${AI_AGENT_SUITE_SYSTEM_PROMPT[tool]}
${languageLine}

User request: ${userPrompt}

Respond with well-formatted plain text (short paragraphs and bullet points where useful — no markdown headers, no code fences). Respond with strict JSON matching this shape:
{"response": string}`;

  const raw = await callTextModel(prompt, 0.7);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiAgentError('Gemini returned malformed JSON.');
  }
  const result = aiAgentSuiteResponseSchema.safeParse(parsed);
  if (!result.success) throw new AiAgentError('Gemini returned an unexpected response format.');
  return result.data.response;
}
