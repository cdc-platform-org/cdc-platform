import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { callTextModel, callTextModelPlain, AiAgentError } from '../services/aiAgentService';

// ============================================================
// AI Language Teacher — backs Frontend's SmartReader (src/components/tools/
// SmartReader.tsx, rendered on the homepage): explain/translate a selected
// word or phrase, and grade a recorded pronunciation attempt. Uses this
// codebase's real AI provider chain (aiAgentService's Gemini-then-Azure-
// OpenAI fallback), same as every other AI route here — no separate
// provider/API key of its own.
// ============================================================

const router = Router();

function respondAiError(res: Response, err: unknown) {
  if (err instanceof AiAgentError) return res.status(err.status).json({ message: err.message });
  throw err;
}

router.post('/explain', async (req: Request, res: Response) => {
  const { text, targetPhrase, learningLanguage, nativeLanguage } = req.body;
  try {
    const explanation = await callTextModelPlain(
      `Explain the phrase "${targetPhrase}" in the context of "${text}", for a student learning ${learningLanguage} whose native language is ${nativeLanguage}. Include a definition, its CEFR level, a ${nativeLanguage} translation, and two example sentences.`,
      0.3
    );
    res.json({ explanation });
  } catch (err) {
    respondAiError(res, err);
  }
});

router.post('/translate', async (req: Request, res: Response) => {
  const { targetPhrase, learningLanguage, nativeLanguage } = req.body;
  try {
    const translation = await callTextModelPlain(
      `Translate the phrase "${targetPhrase}" from ${learningLanguage} to ${nativeLanguage}. Respond with ONLY the translation, no explanation.`,
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
const SUMMARIZE_TIMEOUT_MS = 10_000;
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

router.post('/summarize', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.json({ summary: fallbackSummary(typeof text === 'string' ? text : '') });
  }

  const wordCount = text.trim().split(/\s+/).length;
  const prompt =
    wordCount <= SHORT_TEXT_WORD_THRESHOLD
      ? `The following input is very short (a single word or short phrase), too short to genuinely "summarize" — instead, give a brief definition/explanation of it (2-3 sentences), then its CEFR complexity level (A1, A2, B1, B2, C1, or C2) as a learner vocabulary item. Respond in EXACTLY this format, no markdown, no extra commentary:
<explanation text>
CEFR Level: <level>

Text: "${text}"`
      : `Summarize the following text in 2-3 sentences, then give its CEFR complexity level (A1, A2, B1, B2, C1, or C2). Respond in EXACTLY this format, no markdown, no extra commentary:
<summary text>
CEFR Level: <level>

Text: "${text}"`;

  try {
    const result = await withTimeout(callTextModelPlain(prompt, 0.3), SUMMARIZE_TIMEOUT_MS);
    const summary = result === 'TIMEOUT' ? fallbackSummary(text) : result;
    res.json({ summary });
  } catch (err) {
    console.error('[languageTeacher] /summarize failed, using local fallback:', err instanceof Error ? err.message : err);
    res.json({ summary: fallbackSummary(text) });
  }
});

export default router;
