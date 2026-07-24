import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { translateBlogPost, isAiTranslateConfigured, AiTranslateError } from '../services/aiTranslateService';

const router = Router();

const translateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string().min(1),
});

// Admin-only — used by the "✨ Auto-Translate to English" button in
// /admin/blog. Not exposed publicly since it burns Gemini quota per call.
router.post('/translate', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiTranslateConfigured()) {
    return res.status(501).json({ message: 'AI translation is not configured yet (GEMINI_API_KEY).' });
  }

  const result = translateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const translated = await translateBlogPost(result.data);
    res.json({ data: translated });
  } catch (err) {
    if (err instanceof AiTranslateError) {
      return res.status(502).json({ message: err.message });
    }
    throw err;
  }
});

export default router;
