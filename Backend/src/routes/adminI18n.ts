import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { runI18nAutoTranslateAgent, auditOrphanedKeys } from '../services/aiTranslationAgent';

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

// TOOL C — Missing Locales Audit & Cleanup. Read-only report of keys
// present in a locale file but absent from en/ (the reference) — see
// aiTranslationAgent.ts's auditOrphanedKeys for what this does and doesn't
// check.
router.get('/audit-orphaned-keys', async (req: Request, res: Response) => {
  try {
    const groups = await auditOrphanedKeys();
    res.json({ data: { groups, totalOrphanedKeys: groups.reduce((sum, g) => sum + g.orphanedKeys.length, 0) } });
  } catch (err: any) {
    res.status(502).json({ message: err?.message ?? 'The locale audit failed.' });
  }
});

export default router;
