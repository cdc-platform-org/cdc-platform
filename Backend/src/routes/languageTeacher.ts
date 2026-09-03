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

router.post('/summarize', async (req: Request, res: Response) => {
  const { text } = req.body;
  try {
    const summary = await callTextModelPlain(
      `Summarize the following text in 2-3 sentences, then give its CEFR complexity level (A1, A2, B1, B2, C1, or C2). Respond in EXACTLY this format, no markdown, no extra commentary:
<summary text>
CEFR Level: <level>

Text: "${text}"`,
      0.3
    );
    res.json({ summary });
  } catch (err) {
    respondAiError(res, err);
  }
});

export default router;
