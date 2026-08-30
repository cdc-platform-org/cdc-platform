import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { isTtsConfigured, listVoices, synthesizeSpeech, AzureSpeechError, MAX_TTS_TEXT_LENGTH } from '../services/azureSpeechService';

// ============================================================
// Text-to-Speech routes — Feature A of the AI Voice & Video Media Studio
// (Frontend's /dashboard/tools/media-studio). Every route is authenticated:
// Azure Speech is billed per character, so this must never be reachable
// anonymously, same posture as every other paid-AI endpoint in this codebase.
// ============================================================

const router = Router();

router.get('/voices', authenticate, async (_req: Request, res: Response) => {
  if (!isTtsConfigured()) {
    return res.status(501).json({ message: 'Text-to-speech is not configured yet (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION).' });
  }
  try {
    const voices = await listVoices();
    res.json({ data: voices });
  } catch (err) {
    if (err instanceof AzureSpeechError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

const synthesizeSchema = z.object({
  text: z.string().min(1).max(MAX_TTS_TEXT_LENGTH),
  voiceShortName: z.string().min(1),
  voiceLocale: z.string().min(1),
  speed: z.number().min(0.5).max(2).optional().default(1),
});

// A real Azure resource call per request — rate-limited per IP on top of
// the mandatory login, same "authenticate + IP budget" shape as ai.ts's
// course-tutor endpoint, sized for genuine iterative narration tweaking
// (re-generating after editing text/voice/speed) without leaving room for
// bulk quota-draining abuse.
const synthesizeRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many narration requests. Please wait a few minutes before trying again.',
});

router.post('/synthesize', authenticate, synthesizeRateLimit, async (req: Request, res: Response) => {
  if (!isTtsConfigured()) {
    return res.status(501).json({ message: 'Text-to-speech is not configured yet (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION).' });
  }
  const parsed = synthesizeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  try {
    const audio = await synthesizeSpeech(parsed.data);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="narration.mp3"');
    res.send(audio);
  } catch (err) {
    if (err instanceof AzureSpeechError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
