import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { isAiAgentConfigured, generateBlogDraft, generateCoverImage, AiAgentError } from '../services/aiAgentService';
import { logAiGeneration } from '../services/aiGenerationLogService';

const router = Router();

const generateSchema = z.object({ topic: z.string().trim().max(200).optional() });

// Admin-only — powers the "✨ სტატიის გენერირება AI-ით" button in
// /admin/blog. Returns generated fields for the admin to review/edit; does
// NOT create a BlogPost row (same "fill the form, admin still clicks
// Create" UX as the existing Auto-Translate button in routes/ai.ts).
router.post('/generate-ai', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) {
    return res.status(501).json({ message: 'AI agent is not configured yet (GEMINI_API_KEY).' });
  }

  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const topic = result.data.topic;

  try {
    const draft = await generateBlogDraft(topic);
    // Best-effort — a failed/quota-exhausted image call must not fail the
    // whole draft, see generateCoverImage()'s own doc comment.
    const imageUrl = await generateCoverImage(draft.imageConcept);

    logAiGeneration({
      module: 'blog_manual',
      status: 'success',
      inputContext: { topic: topic ?? null, imageGenerated: !!imageUrl },
      outputSummary: draft.title,
    }).catch(() => {});

    res.json({
      data: {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        category: draft.category,
        titleEn: draft.titleEn,
        descriptionEn: draft.descriptionEn,
        contentEn: draft.contentEn,
        imageUrl: imageUrl ?? '',
      },
    });
  } catch (err) {
    logAiGeneration({
      module: 'blog_manual',
      status: 'failed',
      inputContext: { topic: topic ?? null },
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    if (err instanceof AiAgentError) return res.status(502).json({ message: err.message });
    throw err;
  }
});

export default router;
