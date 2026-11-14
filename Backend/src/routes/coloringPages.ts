/**
 * Express router mounted at `/api/coloring-pages` (see server.ts): the AI
 * coloring-page tool. Logic lives in services/coloringPages/; buying credit
 * packs is routes/payments/coloringCreditsCheckout.ts.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { COLORING_PACKS, COLORING_LIMITS } from '../services/coloringPages/coloringPacks';
import { getColoringAccount } from '../services/coloringPages/coloringCreditService';
import {
  generateColoringPage,
  ColoringGenerationError,
  listColoringPages,
  readColoringPageImage,
  deleteColoringPage,
} from '../services/coloringPages/coloringPageService';

const router = Router();

// IP-level burst guard on top of the per-user hourly limit in the service.
const generateRateLimit = rateLimit({ windowMs: 60 * 1000, max: 6, message: 'Too many requests. Please wait a moment.' });

const STATUS_BY_CODE: Record<ColoringGenerationError['code'], number> = {
  NOT_CONFIGURED: 503,
  INVALID_TOPIC: 400,
  RATE_LIMITED: 429,
  BUSY: 409,
  NO_CREDITS: 402,
  BLOCKED: 422,
  FAILED: 502,
};

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const [account, pages] = await Promise.all([getColoringAccount(req.user!.id), listColoringPages(req.user!.id)]);
  res.json({
    balance: account.balance,
    freeAvailable: !account.freeUsed,
    packs: COLORING_PACKS,
    limits: { topicMaxLength: COLORING_LIMITS.topicMaxLength, pagesPerHour: COLORING_LIMITS.pagesPerHour },
    pages,
  });
});

const generateSchema = z.object({ topic: z.string().min(2).max(COLORING_LIMITS.topicMaxLength) });

router.post('/generate', generateRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'INVALID_TOPIC', message: 'Invalid topic.' });
  try {
    const page = await generateColoringPage(req.user!.id, parsed.data.topic);
    const account = await getColoringAccount(req.user!.id);
    res.status(201).json({ page, balance: account.balance, freeAvailable: !account.freeUsed });
  } catch (err) {
    if (err instanceof ColoringGenerationError) {
      return res.status(STATUS_BY_CODE[err.code]).json({ code: err.code, reason: err.reason ?? null, message: err.message });
    }
    throw err;
  }
});

router.get('/:id/image', authenticate, async (req: Request, res: Response) => {
  const buffer = await readColoringPageImage(req.user!.id, req.params.id);
  if (!buffer) return res.status(404).json({ message: 'Not found.' });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(buffer);
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const ok = await deleteColoringPage(req.user!.id, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Not found.' });
  res.json({ ok: true });
});

export default router;
