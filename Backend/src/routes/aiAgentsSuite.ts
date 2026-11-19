/**
 * Express router mounted at `/api/ai-agents` (see server.ts).
 * Endpoints:
 *   GET /state
 *   POST /generate
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { isAiAgentConfigured, generateAiAgentSuiteResponse, AiAgentSuiteTool, AiAgentError } from '../services/ai/aiAgentService';
import { getSubscriptionState } from '../services/payments/subscriptionStateService';
import { requireDigitalToolAccess, resolveDigitalToolAccess } from '../services/marketplace/digitalToolAccessService';
import { logAiGeneration } from '../services/ai/aiGenerationLogService';

const router = Router();
router.use(authenticate, requireApproved);

// Same response shape as before (hasAccess/source/trialEndsAt), but the
// decision is the shared one (paid, course, admin grant, 3-day trial).
router.get('/state', async (req: Request, res: Response) => {
  const [state, access] = await Promise.all([getSubscriptionState(req.user!.id), resolveDigitalToolAccess(req.user!.id, req.user!.email, 'ai-agents')]);
  const trial = access.source === 'TRIAL' || access.source === 'LEGACY_TRIAL';
  res.json({ data: { ...state, hasAccess: access.allowed, accessSource: access.source, trialEndsAt: trial ? access.endsAt : state.trialEndsAt, trial: access.trial } });
});

// This was previously unrated-limited despite every call spending real
// Gemini API quota — the active-subscription check gates who can call it,
// not how often, so a subscribed user (or a compromised subscribed
// account) could otherwise hammer it with no cap. Same window/cap shape as
// routes/ai.ts's courseTutorRateLimit for the equivalent AI-cost endpoint.
const aiAgentGenerateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many requests. Please wait a moment before trying again.',
});

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
router.post('/generate', aiAgentGenerateRateLimit, requireDigitalToolAccess('ai-agents', { meter: 1 }), async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) {
    return res.status(501).json({ message: 'AI agent is not configured yet (GEMINI_API_KEY).' });
  }

  const result = generateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

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
