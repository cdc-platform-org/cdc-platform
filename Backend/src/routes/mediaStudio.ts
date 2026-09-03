import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { multerErrorHandler } from '../middleware/productUploads';
import {
  isMediaStudioUploadConfigured,
  isMediaStudioYoutubeConfigured,
  isValidYoutubeUrl,
  transcribeFromUpload,
  transcribeFromYoutube,
  MediaStudioError,
} from '../services/mediaStudioService';
import { sendMediaStudioExport } from '../services/emailService';
import { callTextModelPlain, AiAgentError } from '../services/aiAgentService';

// ============================================================
// AI Voice & Video Media Studio — Feature B routes (video/audio ->
// transcript + notes) and the "send via email" export action. Feature A
// (text-to-speech) lives in routes/tts.ts.
// ============================================================

const router = Router();

// Uploaded lecture/meeting videos are typically far larger than the
// product-preview clips productUploads.ts's videoUpload was sized for
// (50MB) — this feature's own limit, not shared with that middleware.
// webm is accepted alongside mp4/mov since that's the default recording
// format for several browser/screen-recorder tools.
const mediaStudioVideoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (/^(video|audio)\//.test(file.mimetype) || /\.(mp4|mov|webm|mp3|wav|m4a)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only MP4, MOV, WEBM, MP3, WAV, or M4A files are allowed.'));
  },
  limits: { fileSize: 300 * 1024 * 1024 },
});

// Each request either extracts+uploads a full video to Gemini's File API or
// hands Gemini a YouTube URL to fetch itself — both genuinely expensive
// (time and quota), so the budget here is deliberately tighter than the
// TTS/course-tutor endpoints' per-IP limits.
const transcribeRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 8,
  message: 'Too many transcription requests. Please wait before trying again.',
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  mediaStudioVideoUpload.single('video')(req, res, (err: any) => multerErrorHandler(req, res, err, next));
}

const youtubeSchema = z.object({ youtubeUrl: z.string().min(1) });

router.post('/transcribe', authenticate, transcribeRateLimit, handleUpload, async (req: Request, res: Response) => {
  try {
    if (req.file) {
      if (!isMediaStudioUploadConfigured()) {
        return res.status(501).json({ message: 'Video transcription is not configured yet (GEMINI_API_KEY / ffmpeg).' });
      }
      const result = await transcribeFromUpload(req.file.buffer);
      return res.json({ data: result });
    }

    const parsed = youtubeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Provide either a video file upload or a youtubeUrl.' });
    }
    if (!isMediaStudioYoutubeConfigured()) {
      return res.status(501).json({ message: 'Video transcription is not configured yet (GEMINI_API_KEY).' });
    }
    if (!isValidYoutubeUrl(parsed.data.youtubeUrl)) {
      return res.status(400).json({ message: 'Please provide a valid YouTube video URL.' });
    }
    const result = await transcribeFromYoutube(parsed.data.youtubeUrl);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof MediaStudioError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

const emailExportSchema = z
  .object({
    to: z.string().email(),
    transcript: z.string().max(200_000).optional(),
    notes: z.string().max(200_000).optional(),
    lang: z.enum(['ka', 'en']).optional(),
  })
  .refine((data) => !!data.transcript || !!data.notes, { message: 'Nothing to send — provide a transcript and/or notes.' });

// Same login + rate-limit posture as the transcribe endpoint above (see
// emailService.sendMediaStudioExport's own comment on why an arbitrary
// user-composed recipient is acceptable here specifically).
const emailExportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many export emails sent. Please wait before trying again.',
});

router.post('/email', authenticate, emailExportRateLimit, async (req: Request, res: Response) => {
  const parsed = emailExportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  await sendMediaStudioExport({
    to: parsed.data.to,
    senderEmail: req.user!.email,
    transcript: parsed.data.transcript,
    notes: parsed.data.notes,
    lang: parsed.data.lang,
  });
  res.json({ message: 'Sent.' });
});

const translateSchema = z.object({
  text: z.string().min(1).max(2000),
  targetLanguage: z.string().min(1).max(60),
});

// Same login + per-IP budget shape as tts.ts's /synthesize — a real Gemini
// call per request, sized for a visitor translating a few highlighted
// selections while reading, not bulk translation.
const translateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many translation requests. Please wait a few minutes before trying again.',
});

router.post('/translate', authenticate, translateRateLimit, async (req: Request, res: Response) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.errors });

  try {
    const translation = await callTextModelPlain(
      `Translate the following text into ${parsed.data.targetLanguage}. Respond with ONLY the translation — no explanation, no quotes, no original text:\n\n${parsed.data.text}`,
      0.1
    );
    res.json({ data: { translation: translation.trim() } });
  } catch (err) {
    if (err instanceof AiAgentError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
