import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { callAzureChatCompletion } from './azureChatCompletionService';

// ============================================================
// In-course AI Tutor — powers POST /api/ai/course-tutor. Same provider/
// pattern as services/businessAiChatService.ts, but the "knowledge base"
// here is the specific course/section/lesson the student is currently
// viewing instead of an admin-configured KnowledgeDocument set.
//
// High-availability chain: Azure OpenAI primary region -> Azure OpenAI
// secondary region (a fully separate resource, different key/region —
// automatic failover on 429/5xx/timeout, see azureChatCompletionService.ts)
// -> Gemini (cross-vendor fallback, only when GEMINI_API_KEY is configured)
// before finally surfacing one graceful error to the student.
// ============================================================

export function isCourseTutorConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

export class CourseTutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseTutorError';
  }
}

export interface TutorChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface GenerateTutorReplyParams {
  // Cache key scope — see responseCache below. Not sent to the model.
  lessonId: string;
  courseTitle: string;
  courseDescription: string;
  sectionTitle: string;
  lessonTitle: string;
  assignmentPrompt: string | null;
  resources: string[];
  // Prior turns in this conversation, oldest first — the caller
  // (routes/ai.ts) caps this before it reaches here.
  history: TutorChatTurn[];
  message: string;
}

// Bounds the prompt size for a long tutoring session, same reasoning as
// businessAiChatService's HISTORY_TURN_LIMIT.
const HISTORY_TURN_LIMIT = 12;

const BASE_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Primary/secondary Azure region failover (with its own internal retry) now
// lives in azureChatCompletionService.ts, shared across every direct Azure
// caller in this codebase — this is a thin pass-through so the rest of this
// file (Gemini fallback, caching) doesn't need to know about it.
async function callAzureTutor(messages: ChatMessage[]): Promise<string> {
  return callAzureChatCompletion({ messages });
}

const geminiClient = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const GEMINI_FALLBACK_MODEL = 'gemini-flash-latest';

// Cross-vendor fallback once every Azure attempt above is exhausted — a
// single-shot generateContent call (not a chat session) with the
// conversation flattened into the prompt, same "one string in, one string
// out" shape every other Gemini caller in this codebase uses.
async function callGeminiTutorFallback(systemInstruction: string, history: TutorChatTurn[], message: string): Promise<string> {
  if (!geminiClient) throw new CourseTutorError('Gemini fallback is not configured (GEMINI_API_KEY missing).');

  const historyText = history.length
    ? `\n\nConversation so far:\n${history.map((t) => `${t.role === 'USER' ? 'Student' : 'Tutor'}: ${t.content}`).join('\n')}`
    : '';
  const prompt = `${systemInstruction}${historyText}\n\nStudent: ${message}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const model = geminiClient.getGenerativeModel({ model: GEMINI_FALLBACK_MODEL, generationConfig: { temperature: 0.7 } }, GEMINI_REQUEST_OPTIONS);
      const result = await model.generateContent(prompt);
      const reply = result.response.text();
      if (!reply) throw new CourseTutorError('Gemini fallback returned an empty response.');
      return reply;
    } catch (err) {
      lastErr = err;
      console.error(`[courseTutorService] Gemini fallback attempt ${attempt + 1}/2 failed:`, err instanceof Error ? err.message : err);
      if (attempt < 1) await sleep(BASE_RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

// ============================================================
// IN-MEMORY RESPONSE CACHE — a fresh-conversation (no prior history) query
// on the same lesson is very often the exact same canned question every
// student asks first ("explain this lesson simply", "give me an example"),
// and the answer only depends on the lesson content, never on who's
// asking. Caching it means those repeat requests never trigger a real LLM
// call at all. Deliberately NOT applied once history.length > 0 — a
// follow-up message depends on the specific conversation so far and isn't
// safely shareable across students.
//
// Plain in-memory Map, not Redis — this is a single-process Node backend
// with no existing Redis infrastructure (no client, no connection config)
// anywhere in the codebase, so adding a new stateful dependency for this
// alone would be a disproportionate risk; a Map is lost on restart/across
// instances, which is an acceptable tradeoff for a pure speed/cost
// optimization that always has the real LLM call as a fallback.
// ============================================================
interface CacheEntry {
  reply: string;
  expiresAt: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — lesson content changes rarely.
const CACHE_MAX_ENTRIES = 1000; // simple bound against unbounded growth on a long-running process.

function cacheKey(lessonId: string, message: string): string {
  return `${lessonId}::${message.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.reply;
}

function setCached(key: string, reply: string): void {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    // Oldest-inserted entry (Map preserves insertion order) — cheap
    // approximate LRU without tracking access times separately.
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { reply, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function generateTutorReply(params: GenerateTutorReplyParams): Promise<string> {
  if (!isCourseTutorConfigured()) {
    throw new CourseTutorError('The AI tutor is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }

  const cacheEligible = params.history.length === 0;
  const key = cacheEligible ? cacheKey(params.lessonId, params.message) : null;
  if (key) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const contextLines = [
    `Course: ${params.courseTitle}`,
    `Course description: ${params.courseDescription}`,
    `Current section: ${params.sectionTitle}`,
    `Current lesson: ${params.lessonTitle}`,
  ];
  if (params.assignmentPrompt) contextLines.push(`Assignment for this lesson: ${params.assignmentPrompt}`);
  if (params.resources.length) contextLines.push(`Lesson resources: ${params.resources.join(', ')}`);

  const systemInstruction =
    `You are an expert AI Technical Tutor for the course "${params.courseTitle}". Your focus is to guide the ` +
    `student through the lesson "${params.lessonTitle}" and its assignments. Answer technical questions, ` +
    `explain complex concepts simply, provide code examples, and debug code. Be encouraging, clear, and ` +
    `concise. Guide the student step-by-step rather than giving away direct answers to assignments unless ` +
    `explicitly asked to explain the solution. Stay strictly within the scope of this course's topic — if ` +
    `asked something unrelated, gently redirect the student back to the lesson.\n\n` +
    `Lesson context:\n${contextLines.join('\n')}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemInstruction },
    ...params.history.slice(-HISTORY_TURN_LIMIT).map((turn) => ({
      role: (turn.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: turn.content,
    })),
    { role: 'user', content: params.message },
  ];

  let reply: string;
  try {
    reply = await callAzureTutor(messages);
  } catch (azureErr) {
    console.error('[courseTutorService] Azure exhausted, trying Gemini fallback:', azureErr instanceof Error ? azureErr.message : azureErr);
    try {
      reply = await callGeminiTutorFallback(systemInstruction, params.history.slice(-HISTORY_TURN_LIMIT), params.message);
    } catch (geminiErr) {
      // Both providers failed — one graceful, honest error instead of a raw
      // stack trace reaching the student.
      const lastErr = geminiErr ?? azureErr;
      throw lastErr instanceof CourseTutorError
        ? lastErr
        : new CourseTutorError(
            'The AI tutor is temporarily overloaded. Please try again in a moment.'
          );
    }
  }

  if (key) setCached(key, reply);
  return reply;
}
