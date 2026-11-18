/**
 * Express router mounted at `/api/language-teacher` (see server.ts).
 * Endpoints:
 *   POST /explain
 *   POST /translate
 *   POST /analyze-pronunciation
 *   POST /summarize
 */
import { authenticate, requireApproved } from '../middleware/auth';
import { requireDigitalToolAccess } from '../services/marketplace/digitalToolAccessService';
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { callTextModel, callTextModelPlain, AiAgentError } from '../services/ai/aiAgentService';

// ============================================================
// AI Language Teacher — backs Frontend's SmartReader (src/components/tools/
// SmartReader.tsx, rendered on the homepage): explain/translate a selected
// word or phrase, and grade a recorded pronunciation attempt. Uses this
// codebase's real AI provider chain (aiAgentService's Gemini-then-Azure-
// OpenAI fallback), same as every other AI route here — no separate
// provider/API key of its own.
// ============================================================

const router = Router();
router.use(authenticate, requireApproved, requireDigitalToolAccess('smart-reader'));

function respondAiError(res: Response, err: unknown) {
  if (err instanceof AiAgentError) return res.status(err.status).json({ message: err.message });
  throw err;
}

// The two dropdowns in SmartReader.tsx. Anything else (or a missing value,
// e.g. an older Frontend build) falls back to the old English -> Georgian
// pair, so a free-text value can never be injected into the prompt.
const SUPPORTED_LANGUAGES = [
  'English', 'Georgian', 'German', 'Spanish', 'French', 'Ukrainian', 'Turkish', 'Armenian', 'Azerbaijani', 'Russian', 'Italian',
] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function pickLanguage(value: unknown, fallback: SupportedLanguage): SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : fallback;
}

function languagePair(body: any): { learning: SupportedLanguage; native: SupportedLanguage } {
  return {
    learning: pickLanguage(body?.learningLanguage, 'English'),
    native: pickLanguage(body?.nativeLanguage, 'Georgian'),
  };
}

router.post('/explain', async (req: Request, res: Response) => {
  const { text, targetPhrase } = req.body;
  const { learning, native } = languagePair(req.body);
  try {
    const explanation = await callTextModelPlain(
      `You are a friendly language teacher. A student whose native language is ${native} is learning ${learning}.
Explain the ${learning} phrase "${targetPhrase}" as it is used in this context: "${text}".
Write the WHOLE explanation in ${native} (not in English, unless ${native} is English). Keep "${targetPhrase}" itself and the example sentences in ${learning}.
Plain text, no markdown. Use exactly these parts:
1. ${native} translation of the phrase
2. Meaning in this context (1-2 sentences in ${native})
3. CEFR level (A1-C2)
4. Two short example sentences in ${learning}, each followed by its ${native} translation in parentheses`,
      0.3
    );
    res.json({ explanation });
  } catch (err) {
    respondAiError(res, err);
  }
});

router.post('/translate', async (req: Request, res: Response) => {
  const { targetPhrase } = req.body;
  const { learning, native } = languagePair(req.body);
  try {
    const translation = await callTextModelPlain(
      `Translate the phrase "${targetPhrase}" from ${learning} to ${native}. Respond with ONLY the translation, no explanation.`,
      0.1
    );
    res.json({ translation });
  } catch (err) {
    respondAiError(res, err);
  }
});

router.post(
  '/analyze-pronunciation',
  [
    body('referenceText').isString().notEmpty().withMessage('referenceText must be a non-empty string'),
    body('transcribedText').isString().notEmpty().withMessage('transcribedText must be a non-empty string'),
    body('learningLanguage').isString().notEmpty().withMessage('learningLanguage must be a non-empty string'),
    body('nativeLanguage').isString().notEmpty().withMessage('nativeLanguage must be a non-empty string'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { referenceText, transcribedText, learningLanguage, nativeLanguage } = req.body;
    try {
      const raw = await callTextModel(
        `Compare the following reference text and transcribed text word by word, for a student learning ${learningLanguage}.
Score each word of the reference text as GREEN (correct), YELLOW (minor mistake), or RED (incorrect/missing), and generate constructive teacher advice in ${nativeLanguage}.
Reference Text: "${referenceText}"
Transcribed Text: "${transcribedText}"
Respond with strict JSON matching this shape: {"words": [{"word": string, "status": "GREEN"|"YELLOW"|"RED", "feedback": string}], "teacherAdvice": string}`,
        0.2
      );
      const { words, teacherAdvice } = JSON.parse(raw);
      res.json({ words, teacherAdvice });
    } catch (err) {
      respondAiError(res, err);
    }
  }
);

// AUDIT NOTE (fixed): reported live as "Error summarizing text." on short or
// single-word input (e.g. "language") — the prompt unconditionally asked
// Gemini to "Summarize ... in 2-3 sentences", a degenerate, nonsensical ask
// for a single word, which reliably produced an empty/refused response
// (aiAgentService's Gemini cascade correctly treats that as a failure and
// exhausts every model/retry before genuinely throwing) rather than a
// content problem the prompt itself should never have created. Two fixes:
// (1) the prompt now explicitly branches on short input, asking for a
// definition-style response instead of an impossible summary, while still
// requiring the exact same output format so the Frontend's
// `.split('CEFR Level:')` parsing never has to change; (2) a 10s interactive
// budget (this is a real person waiting on a result, not a bulk-generation
// call — see courseTutorService.ts's identical reasoning/value) with a
// clean, correctly-formatted local fallback on ANY failure (timeout,
// exhausted providers, malformed response) instead of ever throwing —
// "Error summarizing text." should no longer be reachable through an AI
// failure at all, short input or not.
// Raised from 10s: the answer is now JSON in two languages + key words.
const SUMMARIZE_TIMEOUT_MS = 20_000;
const SHORT_TEXT_WORD_THRESHOLD = 5;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'TIMEOUT'> {
  return Promise.race([promise, new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), ms))]);
}

function fallbackSummary(text: string): string {
  const trimmed = text.trim();
  const notice = trimmed
    ? `"${trimmed}" — a detailed explanation isn't available right now, please try again shortly.`
    : 'No text was provided to summarize.';
  // Same exact <summary>\nCEFR Level: <level> contract the real AI response
  // uses — the Frontend's parsing has no separate "this was a fallback"
  // branch to maintain, it just always works.
  return `${notice}\nCEFR Level: B1`;
}

// Analysis is written in the learner's NATIVE language (the right-hand
// dropdown) — e.g. Spanish text + ქართული -> the explanation is in Georgian —
// with the same explanation in the text's own language underneath, plus the
// key words with their native-language meaning. `summary` keeps the old
// "<text>\nCEFR Level: <level>" contract so an older Frontend build still works.
interface VocabularyItem { word: string; meaning: string; explanation?: string }
interface TextAnalysis {
  cefrLevel: string;
  explanation: string;
  explanationSource: string;
  vocabulary: VocabularyItem[];
  learningLanguage: SupportedLanguage;
  nativeLanguage: SupportedLanguage;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function str(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function parseAnalysis(raw: string, learning: SupportedLanguage, native: SupportedLanguage): TextAnalysis | null {
  let data: any;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  const explanation = str(data?.explanation);
  if (!explanation) return null;
  const level = str(data?.cefrLevel, 4).toUpperCase();
  const vocabulary: VocabularyItem[] = Array.isArray(data?.vocabulary)
    ? data.vocabulary
        .map((v: any) => ({ word: str(v?.word, 80), meaning: str(v?.meaning, 200), explanation: str(v?.explanation, 400) || undefined }))
        .filter((v: VocabularyItem) => v.word && v.meaning)
        .slice(0, 8)
    : [];
  return {
    cefrLevel: CEFR_LEVELS.includes(level) ? level : 'B1',
    explanation,
    explanationSource: learning === native ? '' : str(data?.explanationSource),
    vocabulary,
    learningLanguage: learning,
    nativeLanguage: native,
  };
}

export function buildAnalysisPrompt(text: string, learning: SupportedLanguage, native: SupportedLanguage): string {
  const short = text.trim().split(/\s+/).length <= SHORT_TEXT_WORD_THRESHOLD;
  const task = short
    ? `The input is a single word or short phrase: explain what it means and how it is used (2-3 sentences).`
    : `Summarize the text and explain what it says (2-4 sentences).`;
  return `You are a friendly language teacher. The student's native language is ${native}. The student is learning ${learning}; the text below is written in ${learning} (if it is clearly in another language, treat that language as the source language instead).
${task}
Rules:
- "explanation": written ENTIRELY in ${native}${native === 'English' ? '' : ' (do NOT answer in English)'}.
- "explanationSource": the same explanation written in the text's own language (${learning})${learning === native ? '; use an empty string because both languages are the same' : ''}.
- "vocabulary": the ${short ? '1-3' : '3-6'} most useful or difficult words/expressions from the text, each with "word" (exactly as in the text), "meaning" (short ${native} translation) and "explanation" (one short sentence in ${native}).
- "cefrLevel": the text's CEFR level, one of A1, A2, B1, B2, C1, C2.
Respond with strict JSON only: {"explanation": string, "explanationSource": string, "vocabulary": [{"word": string, "meaning": string, "explanation": string}], "cefrLevel": string}

Text: "${text}"`;
}

function fallbackAnalysis(text: string, learning: SupportedLanguage, native: SupportedLanguage): TextAnalysis {
  const [explanation, cefr] = fallbackSummary(text).split('\nCEFR Level: ');
  return { cefrLevel: cefr, explanation, explanationSource: '', vocabulary: [], learningLanguage: learning, nativeLanguage: native };
}

router.post('/summarize', async (req: Request, res: Response) => {
  const { text } = req.body;
  const { learning, native } = languagePair(req.body);
  const send = (analysis: TextAnalysis) =>
    res.json({ summary: `${analysis.explanation}\nCEFR Level: ${analysis.cefrLevel}`, analysis });

  if (typeof text !== 'string' || !text.trim()) {
    return send(fallbackAnalysis(typeof text === 'string' ? text : '', learning, native));
  }

  try {
    const raw = await withTimeout(
      callTextModel(buildAnalysisPrompt(text.slice(0, 6000), learning, native), 0.3, undefined, { timeoutMs: SUMMARIZE_TIMEOUT_MS }),
      SUMMARIZE_TIMEOUT_MS
    );
    const analysis = raw === 'TIMEOUT' ? null : parseAnalysis(raw, learning, native);
    send(analysis ?? fallbackAnalysis(text, learning, native));
  } catch (err) {
    console.error('[languageTeacher] /summarize failed, using local fallback:', err instanceof Error ? err.message : err);
    send(fallbackAnalysis(text, learning, native));
  }
});

export default router;
