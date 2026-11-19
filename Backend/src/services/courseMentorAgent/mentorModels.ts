/**
 * Course Mentor Agent — which AI model does which job (cost control).
 * Exports: chatWithMini, chatWithMain, shouldEscalate, jsonWithModel, ModelTier.
 *
 * The seat price (19 GEL/student/month, config/courseMentorPricing.ts) only works if the high-volume live
 * chat runs on the cheap model:
 *   - 'mini'  -> Azure OpenAI gpt-4o-mini deployment (AZURE_OPENAI_MINI_DEPLOYMENT,
 *                default "gpt-4o-mini"): tutoring chat, practice task generation.
 *   - 'main'  -> the platform's main chain (aiAgentService.callTextModel:
 *                gpt-4o primary -> secondary region -> Gemini): planning,
 *                grading and teacher-facing evaluations, where accuracy matters.
 * If the mini deployment fails (missing, throttled), calls fall back to the
 * main chain so a student is never left without an answer.
 */
import { AzureOpenAI } from 'openai';
import { z } from 'zod';
import { AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_VERSION } from '../../utils/env';
import { callAzureChatCompletion, AzureChatMessage } from '../ai/azureChatCompletionService';
import { callTextModel } from '../ai/aiAgentService';
import { parseModelJson } from './curriculumPlanner';

export type ModelTier = 'mini' | 'main';

const MINI_DEPLOYMENT = (process.env.AZURE_OPENAI_MINI_DEPLOYMENT || 'gpt-4o-mini').trim();

let miniClient: AzureOpenAI | null = null;
function getMiniClient(): AzureOpenAI | null {
  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT || !MINI_DEPLOYMENT) return null;
  if (!miniClient) {
    miniClient = new AzureOpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      endpoint: AZURE_OPENAI_ENDPOINT,
      apiVersion: AZURE_OPENAI_API_VERSION,
      deployment: MINI_DEPLOYMENT,
      timeout: 45_000,
      maxRetries: 1,
    });
  }
  return miniClient;
}

async function callMini(messages: AzureChatMessage[], opts: { json: boolean; maxTokens: number; temperature: number }): Promise<string> {
  const client = getMiniClient();
  if (!client) throw new Error('Mini model not configured.');
  const res = await client.chat.completions.create({
    model: MINI_DEPLOYMENT,
    messages: messages as never,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const content = res.choices[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty response from mini model.');
  return content;
}

// Conversational turn for the tutor chat (plain text / Markdown).
export async function chatWithMini(messages: AzureChatMessage[], maxTokens = 900): Promise<string> {
  try {
    return await callMini(messages, { json: false, maxTokens, temperature: 0.6 });
  } catch (err) {
    console.warn('[courseMentor/models] mini chat failed, using main model:', (err as Error).message);
    return callAzureChatCompletion({ messages, temperature: 0.6, maxOutputTokens: maxTokens });
  }
}

// Escalated tutor turn on the main model (gpt-4o). Callers trim the context
// first (fewer history turns / excerpts) since this is ~15x the mini price.
export async function chatWithMain(messages: AzureChatMessage[], maxTokens = 900): Promise<string> {
  return callAzureChatCompletion({ messages, temperature: 0.5, maxOutputTokens: maxTokens });
}

const CONFUSION = /(ვერ\s*გავიგე|არ\s*მესმის|ვერ\s*ვხვდები|გაუგებარ|don'?t\s+(get|understand)|confus|lost|stuck|не\s+понима|не\s+розумі|anlamad|verstehe\s+nicht|no\s+entiendo|je\s+ne\s+comprends)/i;
// Code-specific signals only matter for programming material; the general
// signal for any subject is a long, multi-part question.
const HARD_CODE = /(error|exception|bug|debug|stack\s*trace|undefined|null\s*pointer|segmentation)/i;

// When a mini answer is likely not good enough (any subject): the learner
// says they are lost, failed the last checks, asks a long multi-part
// question, or brings real code / an error to debug.
export function shouldEscalate(input: { message: string; recentWrongAnswers: number }): boolean {
  if (input.recentWrongAnswers >= 2) return true;
  if (CONFUSION.test(input.message)) return true;
  if (input.message.length >= 900) return true;
  const codeLines = input.message.split('\n').length - 1;
  if (/```/.test(input.message) && codeLines >= 8) return true;
  return HARD_CODE.test(input.message) && codeLines >= 3;
}

// One JSON task (generation, grading, evaluation) validated with zod; one
// retry on invalid JSON before giving up.
export async function jsonWithModel<T>(
  tier: ModelTier,
  prompt: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  maxTokens = 3000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let raw: string;
      if (tier === 'mini') {
        try {
          raw = await callMini([{ role: 'user', content: prompt }], { json: true, maxTokens, temperature: 0.4 });
        } catch (err) {
          console.warn('[courseMentor/models] mini json failed, using main model:', (err as Error).message);
          raw = await callTextModel(prompt, 0.3, undefined, { maxOutputTokens: maxTokens, timeoutMs: 120_000 });
        }
      } else {
        raw = await callTextModel(prompt, 0.3, undefined, { maxOutputTokens: maxTokens, timeoutMs: 120_000 });
      }
      return parseModelJson(raw, schema);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
