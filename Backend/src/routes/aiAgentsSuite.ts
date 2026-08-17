import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { isAiAgentConfigured, generateAiAgentSuiteResponse, AiAgentSuiteTool, AiAgentError } from '../services/aiAgentService';
import { hasAiAgentsSuiteAccess } from '../utils/aiAgentsSuiteAccess';
import { logAiGeneration } from '../services/aiGenerationLogService';

const router = Router();
router.use(authenticate, requireApproved);

const generateSchema = z.object({
  tool: z.enum(['content', 'analytics', 'assistant']),
  prompt: z.string().trim().min(3).max(2000),
  lang: z.enum(['ka', 'en']).optional(),
});

// Tool-invocation endpoint for the Business AI Agents Suite
// (/dashboard/ai-tools). Server-side re-check of access is mandatory here
// regardless of what the frontend banner already shows — the frontend gate
// is UX only (same "never trust the client for enforcement" pattern as
// utils/marketplaceCategories.ts's Business Tools purchase gate).
router.post('/generate', async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) {
    return res.status(501).json({ message: 'AI agent is not configured yet (GEMINI_API_KEY).' });
  }

  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { role: true, aiTrialEndsAt: true, aiSubscriptionActive: true },
  });
  if (!hasAiAgentsSuiteAccess(user)) {
    return res.status(403).json({ message: 'Your AI Agents Suite trial has expired. Upgrade to keep using these tools.' });
  }

  try {
    const response = await generateAiAgentSuiteResponse(result.data.tool as AiAgentSuiteTool, result.data.prompt, result.data.lang ?? 'ka');
    logAiGeneration({
      module: `ai_agents_suite_${result.data.tool}`,
      status: 'success',
      inputContext: { userId: req.user!.id },
      outputSummary: result.data.prompt.slice(0, 200),
    }).catch(() => {});
    res.json({ data: { response } });
  } catch (err) {
    logAiGeneration({
      module: `ai_agents_suite_${result.data.tool}`,
      status: 'failed',
      inputContext: { userId: req.user!.id },
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});
    if (err instanceof AiAgentError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
