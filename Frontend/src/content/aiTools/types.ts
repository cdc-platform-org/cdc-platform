// Shape of the AI tool catalog copy (names, descriptions, paywall texts).
// One file per locale in this folder; loaded lazily by ./index.ts so a tool
// page only downloads its own language. Prices, trial caps and units come
// from the backend (/api/digital-tools/catalog) — never hard-coded here.

export type AiToolKey =
  | 'english-tutor' | 'smart-reader' | 'educator-hub' | 'ai-agents' | 'chatbot-builder'
  | 'media-studio' | 'design-studio' | 'code-studio' | 'proctoring' | 'childrens-book' | 'coloring-pages';

export type AiToolUnit = 'book' | 'request' | 'generation' | 'message' | 'exam' | 'page';

export interface AiToolCopy {
  name: string;
  /** One line under the name (catalog card, paywall header). */
  tagline: string;
  /** Two or three sentences on what the tool does and who it is for. */
  description: string;
  /** Concrete things the buyer gets — 4 short lines. */
  features: string[];
}

export interface AiToolsUi {
  checking: string;
  whatYouGet: string;
  trialTitle: string;
  /** e.g. "3 days free · up to 3 books" */
  trialIncludes: (days: number, amount: string) => string;
  trialNoCard: string;
  startTrial: string;
  startingTrial: string;
  trialUsed: string;
  buyTitle: string;
  perPeriod: (days: number) => string;
  buyMonthly: string;
  payDiscounted: (amount: string) => string;
  redirecting: string;
  noAutoRenew: string;
  perBookFrom: string;
  bookRange: (min: string, max: string) => string;
  createBook: string;
  bookNote: string;
  packsTitle: string;
  buyPack: string;
  packCredits: (n: number) => string;
  packNote: string;
  lockedTitle: (name: string) => string;
  lockedBody: string;
  limitTitle: string;
  limitBody: (amount: string) => string;
  expiredTitle: string;
  expiredBody: string;
  courseEnded: string;
  trialActive: (remaining: string, date: string) => string;
  trialActiveShort: string;
  buyNow: string;
  includedByCourse: (date: string) => string;
  paidUntil: (date: string) => string;
  error: string;
  retry: string;
  alreadyHasAccess: string;
  promo: { placeholder: string; apply: string; applied: string; remove: string; invalid: string };
  status: { trial: string; active: string; included: string; expired: string; available: string; trialEnded: string; comingSoon: string };
  openTool: string;
  learnMore: string;
}

export interface AiToolsLocale {
  /** Intl locale for dates and numbers (e.g. 'ka-GE'). */
  intl: string;
  currency: string;
  tools: Record<AiToolKey, AiToolCopy>;
  /** Unit label for a count: units.book(3) -> "3 books". */
  units: Record<AiToolUnit, (n: number) => string>;
  ui: AiToolsUi;
}
