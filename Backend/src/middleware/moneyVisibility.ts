// Money visibility guard for the admin panel — amounts, prices, payments,
// escrow, revenue, payouts, refunds, commissions and sales stats are for the
// SUPER_ADMIN tier only. Pages that are *entirely* about money (finance,
// payouts, commissions, promos, gift cards, disputes) are gated with
// requireAdminRole('SUPER_ADMIN') in their own routers; this file covers the
// mixed routers where MANAGER/MODERATOR still do non-money work (products,
// courses, live trainings, mentorship, analytics, users, dashboard).
//
// Two halves, both keyed off the same word list (isMoneyKey):
//   - responses: res.json payloads are deep-copied with every money key
//     removed before they leave the server;
//   - requests: money keys are dropped from write bodies, so a non-super
//     admin can save a product/course form but never change its price.
//
// Mount AFTER requireAdminRole() (it reads req.adminRole). Opt-in per router
// on purpose: CMS/template routers round-trip whole JSON documents, where a
// stripped key would be silently deleted on the next save.
import { Request, Response, NextFunction } from 'express';

// Matched against the individual words of a key (camelCase / snake_case /
// kebab-case split), never as a substring — so `feedback`, `network`,
// `sortOrder`, `totalCount` and `successRate` are untouched.
const MONEY_WORDS = new Set([
  'price', 'prices', 'pricing', 'amount', 'amounts', 'revenue', 'revenues', 'income', 'profit',
  'earning', 'earnings', 'earned', 'payout', 'payouts', 'balance', 'balances', 'commission',
  'commissions', 'fee', 'fees', 'tetri', 'cents', 'gel', 'usd', 'eur', 'currency', 'budget',
  'salary', 'wage', 'hourly', 'cost', 'costs', 'spend', 'spent', 'gross', 'net', 'refund',
  'refunds', 'refunded', 'discount', 'discounted', 'sale', 'sales', 'sold', 'escrow',
  'payment', 'payments', 'transaction', 'transactions', 'invoice', 'invoices', 'bog', 'stripe',
  'wallet', 'volume', 'gmv', 'mrr', 'arr', 'money', 'paid',
]);

// Keys that contain a money word but carry no amount and are needed by the
// non-money admin workflows (e.g. "is this a paid or free course" filters).
const ALLOWED_KEYS = new Set(['isPaid', 'paidAt', 'isFree']);

export function splitKeyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

export function isMoneyKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  return splitKeyWords(key).some((w) => MONEY_WORDS.has(w));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Returns a copy with every money key removed at any depth. Dates, Buffers
// and other class instances are passed through untouched.
export function stripMoneyFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripMoneyFields(v)) as unknown as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (isMoneyKey(k)) continue;
    out[k] = stripMoneyFields(v);
  }
  return out as T;
}

export function canSeeMoney(req: Request): boolean {
  return req.adminRole === 'SUPER_ADMIN';
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export function hideMoneyFromNonSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (canSeeMoney(req)) return next();
  // Request bodies are only filtered once the tier is known to be lower
  // than SUPER_ADMIN. When this runs before a per-route requireAdminRole()
  // (adminPanel.ts style) the tier is still unknown here, so only the
  // response half is installed — it decides at send time.
  if (req.adminRole && WRITE_METHODS.has(req.method) && isPlainObject(req.body)) {
    req.body = stripMoneyFields(req.body);
  }
  // Guard against double-wrapping when the middleware is mounted twice.
  const locals = res.locals as { moneyGuarded?: boolean };
  if (!locals.moneyGuarded) {
    locals.moneyGuarded = true;
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => originalJson(canSeeMoney(req) ? body : stripMoneyFields(body))) as Response['json'];
  }
  next();
}
