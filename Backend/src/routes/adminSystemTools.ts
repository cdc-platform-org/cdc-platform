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
  // AUDIT NOTE (added): neither clearCourseTutorCache() (a synchronous
  // in-memory Map op) nor logAdminAction() (already has its own internal
  // try/catch — see auditLogService.ts's own comment: an audit-log write
  // failure must never fail the action it's recording) can actually throw
  // here today, but an explicit try/catch costs nothing and means a future
  // change to either can never turn this into an unhandled 500.
  try {
    const courseTutorCleared = clearCourseTutorCache();
    await logAdminAction({
      action: 'systemTools.clearCache',
      targetType: 'ApplicationCache',
      targetId: 'courseTutor',
      performedById: req.user!.id,
      metadata: { courseTutorCleared },
    });
    res.json({
      success: true,
      data: {
        cleared: [{ name: 'Course Tutor response cache', entriesCleared: courseTutorCleared }],
        note: 'Blog generation and translations are not cached anywhere in this backend — every call already hits the AI provider fresh, so there is nothing to clear for those.',
      },
    });
  } catch (err) {
    console.error('[adminSystemTools] clear-cache failed:', err);
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Failed to clear the application cache.' });
  }
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
  // AUDIT NOTE (added): pingPrimaryAzure/pingSecondaryAzure/pingGemini each
  // already have their own internal try/catch and return a
  // {configured, ok, message, latencyMs} shape on any failure rather than
  // throwing — this outer try/catch is defense-in-depth against a future
  // change to any of the three (or Promise.all itself) turning this into
  // an unhandled 500 instead of a real per-provider red/green status.
  try {
    const [primaryAzure, secondaryAzure, gemini] = await Promise.all([pingPrimaryAzure(), pingSecondaryAzure(), pingGemini()]);
    res.json({
      success: true,
      data: {
        primaryAzure,
        secondaryAzure,
        gemini,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[adminSystemTools] health-check failed:', err);
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Health check failed.' });
  }
});

export default router;
