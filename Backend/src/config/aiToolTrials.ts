/**
 * Free trial rules for every AI tool: one 3-day trial per user per tool,
 * capped in the tool's real cost unit. The counter lives in AiToolTrial
 * (prisma) and is spent by services/marketplace/aiToolTrialService.ts — the
 * tool routes pass `meter` to requireDigitalToolAccess on the endpoints that
 * actually call a paid AI provider.
 */
export const AI_TOOL_TRIAL_DAYS = 3;

export type AiToolTrialUnit = 'book' | 'request' | 'generation' | 'message' | 'exam' | 'page';

export interface AiToolTrialRule {
  cap: number;
  unit: AiToolTrialUnit;
}

// Caps are sized so a trial shows the tool's full value while keeping the
// worst-case provider cost of one trial in the low single-digit GEL range.
export const AI_TOOL_TRIAL_RULES: Record<string, AiToolTrialRule> = {
  'childrens-book': { cap: 3, unit: 'book' },
  'english-tutor': { cap: 30, unit: 'request' },
  'smart-reader': { cap: 30, unit: 'request' },
  'educator-hub': { cap: 15, unit: 'generation' },
  'ai-agents': { cap: 30, unit: 'request' },
  'chatbot-builder': { cap: 100, unit: 'message' },
  'media-studio': { cap: 10, unit: 'generation' },
  'design-studio': { cap: 30, unit: 'request' },
  'code-studio': { cap: 30, unit: 'request' },
  proctoring: { cap: 2, unit: 'exam' },
  'coloring-pages': { cap: 5, unit: 'page' },
};

// The chatbot trial also keeps the normal 1-active-agent limit (routes/agents.ts).

export function aiToolTrialRule(key: string): AiToolTrialRule | null {
  return AI_TOOL_TRIAL_RULES[key] ?? null;
}
