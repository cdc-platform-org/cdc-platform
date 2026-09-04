import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { clearCourseTutorCache } from '../services/courseTutorService';
import { pingPrimaryAzure, pingSecondaryAzure, RegionPingResult } from '../services/azureChatCompletionService';
import { GEMINI_API_KEY } from '../utils/env';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// ============================================================
// TOOL A — Clear & Refresh Application Cache. The only real in-memory TTL
// cache in this backend today is courseTutorService.ts's response cache
// (see that file's own comment) — "Blog" and "Translations" generation are
// NOT cached anywhere in this codebase (each call always hits the LLM
// fresh), so there is nothing to clear for those; this reports that
// honestly rather than pretending to clear caches that don't exist.
// ============================================================
router.post('/clear-cache', async (req: Request, res: Response) => {
  const courseTutorCleared = clearCourseTutorCache();
  await logAdminAction({
    action: 'systemTools.clearCache',
    targetType: 'ApplicationCache',
    targetId: 'courseTutor',
    performedById: req.user!.id,
    metadata: { courseTutorCleared },
  });
  res.json({
    data: {
      cleared: [{ name: 'Course Tutor response cache', entriesCleared: courseTutorCleared }],
      note: 'Blog generation and translations are not cached anywhere in this backend — every call already hits the AI provider fresh, so there is nothing to clear for those.',
    },
  });
});

// ============================================================
// TOOL B — Global System Health Diagnostic & AI Connectivity Test. Pings
// each provider independently (never through the failover wrapper, which
// would mask one region's own failure) so a real red/green status per
// service is possible, not just "is the whole chain working."
// ============================================================
async function pingGemini(): Promise<RegionPingResult> {
  if (!GEMINI_API_KEY) return { configured: false, ok: false, message: 'Not configured', latencyMs: 0 };
  const t0 = Date.now();
  try {
    const client = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: 'gemini-flash-latest' });
    await model.generateContent('ping');
    return { configured: true, ok: true, message: 'OK', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { configured: true, ok: false, message: err instanceof Error ? err.message : 'Unknown error', latencyMs: Date.now() - t0 };
  }
}

router.get('/health-check', async (_req: Request, res: Response) => {
  const [primaryAzure, secondaryAzure, gemini] = await Promise.all([pingPrimaryAzure(), pingSecondaryAzure(), pingGemini()]);
  res.json({
    data: {
      primaryAzure,
      secondaryAzure,
      gemini,
      checkedAt: new Date().toISOString(),
    },
  });
});

export default router;
