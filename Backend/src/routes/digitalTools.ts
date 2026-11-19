/**
 * Express router mounted at `/api/digital-tools` (see server.ts).
 * Endpoints:
 *   GET  /catalog          — price + trial rules for every AI tool (public)
 *   GET  /:key/access      — the caller's access source, trial state, price
 *   POST /:key/trial       — start the one free 3-day trial for this tool
 * The real enforcement is each tool's own backend routes
 * (requireDigitalToolAccess in services/marketplace/digitalToolAccessService.ts);
 * these endpoints only drive the Frontend paywall (DigitalToolAccessGate).
 */
import { Router, Request, Response } from 'express';
import { AI_TOOL_MONTHLY_PRICE_MINOR, AI_TOOL_SUBSCRIPTION_DAYS, aiToolPricingModel } from '../config/aiToolSubscriptions';
import { AI_TOOL_TRIAL_DAYS, AI_TOOL_TRIAL_RULES } from '../config/aiToolTrials';
import { DIGITAL_TOOLS, isDigitalToolKey } from '../config/digitalTools';
import { COLORING_PACKS } from '../services/coloringPages/coloringPacks';
import { calculateBookPrice } from '../services/childrensBook/bookStateService';
import { authenticate, requireApproved, requireNotBannedOrDeleted } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { getCollegeAiAccessStatus } from '../services/learning/collegeAiAccessService';
import { lockedCode, resolveDigitalToolAccess } from '../services/marketplace/digitalToolAccessService';
import { AiToolTrialError, startAiToolTrial } from '../services/marketplace/aiToolTrialService';

const router = Router();

// Book prices come from the same function checkout uses (5–20 pages).
const BOOK_PAGE_OPTIONS = [5, 10, 15, 20];

function pricingFor(key: string) {
  const model = aiToolPricingModel(key);
  if (model === 'MONTHLY') return { model, priceMinor: AI_TOOL_MONTHLY_PRICE_MINOR, periodDays: AI_TOOL_SUBSCRIPTION_DAYS };
  if (model === 'PER_BOOK') {
    const prices = BOOK_PAGE_OPTIONS.map(calculateBookPrice);
    return { model, priceMinor: Math.min(...prices), maxPriceMinor: Math.max(...prices), periodDays: null };
  }
  if (model === 'CREDIT_PACKS') {
    const prices = COLORING_PACKS.map(pack => pack.priceTetri);
    return { model, priceMinor: Math.min(...prices), maxPriceMinor: Math.max(...prices), periodDays: null };
  }
  return { model: null, priceMinor: null, periodDays: null };
}

function trialRuleFor(key: string) {
  const rule = AI_TOOL_TRIAL_RULES[key];
  return rule ? { days: AI_TOOL_TRIAL_DAYS, cap: rule.cap, unit: rule.unit } : null;
}

router.get('/catalog', (_req: Request, res: Response) => {
  res.json({ data: DIGITAL_TOOLS.map(tool => ({ key: tool.key, ...pricingFor(tool.key), trial: trialRuleFor(tool.key) })) });
});

router.get('/:key/access', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!isDigitalToolKey(key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  const [access, college] = await Promise.all([
    resolveDigitalToolAccess(req.user!.id, req.user!.email, key),
    getCollegeAiAccessStatus(req.user!.id, key),
  ]);
  const pricing = pricingFor(key);
  res.json({ data: {
    allowed: access.allowed,
    source: access.source,
    accessEndsAt: access.endsAt,
    lockedReason: access.allowed ? null : lockedCode(access),
    trial: access.trial,
    // Course-linked access (Course.aiToolKeys) for this specific tool.
    collegeAccess: access.source === 'COURSE',
    collegeAccessEndsAt: college.endsAt,
    collegeAccessEnded: college.ended,
    subscriptionEndsAt: access.source === 'PAID' ? access.endsAt : null,
    pricing,
    // Kept for older clients that read the flat fields.
    priceMinor: pricing.priceMinor,
    periodDays: pricing.periodDays,
  } });
});

// A trial start is cheap but once-only; the limiter only stops scripted bursts.
const trialRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many requests. Please wait a moment.' });

router.post('/:key/trial', trialRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const key = req.params.key;
  if (!isDigitalToolKey(key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  const current = await resolveDigitalToolAccess(req.user!.id, req.user!.email, key);
  // Someone who already has access (bought, course, admin) keeps their
  // trial for later instead of burning it on top of paid access.
  if (current.allowed && current.source !== 'TRIAL') {
    return res.status(409).json({ code: 'ALREADY_HAS_ACCESS', message: 'You already have access to this tool.' });
  }
  try {
    const trial = await startAiToolTrial(req.user!.id, key);
    res.status(201).json({ data: { trial } });
  } catch (err) {
    if (err instanceof AiToolTrialError) {
      return res.status(err.code === 'TRIAL_NOT_OFFERED' ? 404 : 409).json({ code: err.code, message: err.message });
    }
    throw err;
  }
});

export default router;
