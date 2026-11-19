// Icon + accent colour for every AI tool, shared by the paywall, the trial
// banner and the My Tools page. Names/descriptions live in src/content/aiTools.
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Bot, BrainCircuit, Code2, GraduationCap, Mic, Palette, PenTool, ShieldCheck, Sparkles, Languages } from 'lucide-react';
import type { ToolAccent } from '../ToolShell';
import type { AiToolKey } from '../../../content/aiTools';

export const AI_TOOL_META: Record<AiToolKey, { icon: LucideIcon; accent: ToolAccent }> = {
  'english-tutor': { icon: GraduationCap, accent: 'emerald' },
  'smart-reader': { icon: Languages, accent: 'cyan' },
  'educator-hub': { icon: Sparkles, accent: 'purple' },
  'ai-agents': { icon: BrainCircuit, accent: 'indigo' },
  'chatbot-builder': { icon: Bot, accent: 'cyan' },
  'media-studio': { icon: Mic, accent: 'pink' },
  'design-studio': { icon: PenTool, accent: 'pink' },
  'code-studio': { icon: Code2, accent: 'indigo' },
  proctoring: { icon: ShieldCheck, accent: 'emerald' },
  'childrens-book': { icon: BookOpen, accent: 'amber' },
  'coloring-pages': { icon: Palette, accent: 'amber' },
};

// Tools whose trial is time-only (no AI provider call to count).
export const TIME_ONLY_TRIAL_TOOLS = new Set<string>(['code-studio']);

export function isAiToolKey(key: string): key is AiToolKey {
  return key in AI_TOOL_META;
}
