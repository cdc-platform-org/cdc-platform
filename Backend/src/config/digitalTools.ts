// Registry of "Digital Tools" (the AI tool pages under /dashboard/tools/*)
// entitlement can be checked against — see services/digitalToolAccessService.ts.
// Digital Tools are plain Next.js page routes, not a database table, so
// this is a small typed constant rather than a Prisma model; a tool's
// `linkedProductId` is optional because not every tool is sold as a
// DigitalProduct today (some are free-to-any-authenticated-user, or gated
// purely by an AccessGrant an admin issues by hand).
export interface DigitalToolDefinition {
  key: string;
  label: string;
  // A DigitalProduct id whose completed ProductPurchase also satisfies this
  // tool's entitlement — e.g. the AI Business Tools trial product. Null for
  // a tool with no matching storefront product (entitlement then comes
  // purely from an AccessGrant).
  linkedProductId: string | null;
}

export const DIGITAL_TOOLS: readonly DigitalToolDefinition[] = [
  { key: 'educator-hub', label: 'Educator Hub', linkedProductId: null },
  { key: 'media-studio', label: 'Media Studio', linkedProductId: null },
  { key: 'chatbot-builder', label: 'AI Chatbot Builder', linkedProductId: null },
];

const DIGITAL_TOOL_KEYS = new Set(DIGITAL_TOOLS.map((tool) => tool.key));

export function isDigitalToolKey(key: string): boolean {
  return DIGITAL_TOOL_KEYS.has(key);
}

export function digitalToolLinkedProductId(key: string): string | null {
  return DIGITAL_TOOLS.find((tool) => tool.key === key)?.linkedProductId ?? null;
}
