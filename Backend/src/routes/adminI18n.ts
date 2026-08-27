import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { runI18nAutoTranslateAgent } from '../services/aiTranslationAgent';

const router = Router();
// SUPER_ADMIN only — this writes to source files on disk and creates a git
// branch, a materially different blast radius than the rest of /admin's
// read/write-DB-only routes.
router.use(authenticate, requireAdminRole('SUPER_ADMIN'));

// Scans public/locales/*/*.json for missing/empty keys vs en/, drafts
// translations via Gemini, and commits the patch to a new local branch —
// never pushes, never touches main (see aiTranslationAgent.ts's own header
// comment for why "auto-push to main" was deliberately not built).
router.post('/auto-translate-and-push', async (req: Request, res: Response) => {
  try {
    const result = await runI18nAutoTranslateAgent();
    await logAdminAction({
      action: 'i18n.autoTranslateAgent.run',
      targetType: 'LocaleFiles',
      targetId: result.gitBranch ?? 'no-op',
      performedById: req.user!.id,
    });
    res.json({ data: result });
  } catch (err: any) {
    res.status(502).json({ message: err?.message ?? 'The translation agent run failed.' });
  }
});

export default router;
