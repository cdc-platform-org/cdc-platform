import { Router, Request, Response } from 'express';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { isDigitalToolKey } from '../config/digitalTools';
import { hasDigitalToolAccess } from '../services/digitalToolAccessService';

const router = Router();

// A single, cheap probe the Frontend calls before rendering a gated tool
// page's full UI — the REAL enforcement is always the tool's own backend
// routes (see mediaStudio.ts's requireMediaStudioAccess); this exists so a
// denied visitor sees a clear "request access" state instead of a page that
// loads, then errors on its first real action.
router.get('/:key/access', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  if (!isDigitalToolKey(req.params.key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  const allowed = await hasDigitalToolAccess(req.user!.id, req.user!.email, req.params.key);
  res.json({ data: { allowed } });
});

export default router;
