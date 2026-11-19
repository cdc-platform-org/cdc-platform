/**
 * 30-day AI tool purchase: one price per tool, in tetri. A purchase provides
 * 30 days; renewals are explicit (no auto-charge). Pay-per-use tools are NOT
 * sold this way: the children's book is paid per book
 * (routes/payments/childrensBookCheckout.ts) and coloring pages per credit
 * pack (routes/payments/coloringCreditsCheckout.ts) — selling them as a flat
 * month would make every book/page free for 29 GEL.
 */
export const AI_TOOL_MONTHLY_PRICE_MINOR = 2900;
export const AI_TOOL_SUBSCRIPTION_DAYS = 30;
export const AI_TOOL_PAYMENT_NOTE = 'AI_TOOL_SUBSCRIPTION:';
export const AI_SUBSCRIPTION_TOOLS = [
  'english-tutor', 'educator-hub', 'media-studio', 'chatbot-builder',
  'proctoring', 'smart-reader', 'ai-agents', 'design-studio', 'code-studio',
] as const;
export type AiSubscriptionToolKey = typeof AI_SUBSCRIPTION_TOOLS[number];
export function isAiSubscriptionTool(key: string): key is AiSubscriptionToolKey {
  return (AI_SUBSCRIPTION_TOOLS as readonly string[]).includes(key);
}

// How each AI tool is bought — the paywall and catalog read this so the
// price shown always matches what checkout charges.
export const PAY_PER_USE_TOOLS = ['childrens-book', 'coloring-pages'] as const;
export type AiToolPricingModel = 'MONTHLY' | 'PER_BOOK' | 'CREDIT_PACKS';
export function aiToolPricingModel(key: string): AiToolPricingModel | null {
  if (isAiSubscriptionTool(key)) return 'MONTHLY';
  if (key === 'childrens-book') return 'PER_BOOK';
  if (key === 'coloring-pages') return 'CREDIT_PACKS';
  return null;
}
