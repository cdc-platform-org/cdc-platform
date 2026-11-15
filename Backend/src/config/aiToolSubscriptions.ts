/** One price per AI tool, in tetri. A purchase provides 30 days; renewals are explicit. */
export const AI_TOOL_MONTHLY_PRICE_MINOR = 2900;
export const AI_TOOL_SUBSCRIPTION_DAYS = 30;
export const AI_TOOL_PAYMENT_NOTE = 'AI_TOOL_SUBSCRIPTION:';
export const AI_SUBSCRIPTION_TOOLS = [
  'english-tutor', 'educator-hub', 'media-studio', 'chatbot-builder',
  'proctoring', 'smart-reader', 'ai-agents', 'childrens-book', 'coloring-pages',
] as const;
export type AiSubscriptionToolKey = typeof AI_SUBSCRIPTION_TOOLS[number];
export function isAiSubscriptionTool(key: string): key is AiSubscriptionToolKey {
  return (AI_SUBSCRIPTION_TOOLS as readonly string[]).includes(key);
}
