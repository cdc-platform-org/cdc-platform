/**
 * Admin picker for Course.aiToolKeys: the AI tools an enrolled student of
 * this (paid) course may use free until the course ends. All other AI tools
 * are bought or trialled as usual. SUPER_ADMIN only (the backend drops the
 * field for other admin tiers — it gives paid tools away).
 * "Suggest" proposes a default from the course category/title, the same
 * rules the 20261119010000 migration used for existing courses.
 */
import { Wand2 } from 'lucide-react';
import { at } from '../../../i18n/admin';

export const COURSE_AI_TOOL_OPTIONS: { key: string; label: string }[] = [
  { key: 'english-tutor', label: 'IMIAKO — AI English Tutor' },
  { key: 'smart-reader', label: 'AI Smart Reader' },
  { key: 'educator-hub', label: 'AI Educator VIP Hub' },
  { key: 'ai-agents', label: 'Business AI Agents' },
  { key: 'chatbot-builder', label: 'AI Chatbot Builder' },
  { key: 'media-studio', label: 'AI Voice & Video Studio' },
  { key: 'design-studio', label: 'Ps + Ai Design Studio' },
  { key: 'code-studio', label: 'SQL & Frontend Code Studio' },
  { key: 'proctoring', label: 'AI-Proctored Exam' },
  { key: 'childrens-book', label: "AI Children's Book" },
  { key: 'coloring-pages', label: 'AI Coloring Pages' },
];

const SUGGESTIONS: { pattern: RegExp; keys: string[] }[] = [
  { pattern: /(დიზაინ|design|გრაფიკ|graphic|ფოტო|photo|ვიდეო|video)/i, keys: ['design-studio', 'media-studio'] },
  { pattern: /(ინგლის|english)/i, keys: ['english-tutor', 'smart-reader'] },
  { pattern: /(პროგრამ|programming|code|sql|web|frontend|backend|python|javascript)/i, keys: ['code-studio'] },
  { pattern: /(მასწავლ|teacher|educat|პედაგოგ)/i, keys: ['educator-hub'] },
  { pattern: /(ბიზნეს|business|მარკეტინგ|marketing|startup|სტარტაპ)/i, keys: ['ai-agents', 'chatbot-builder'] },
];

export function suggestCourseAiTools(category: string, title: string): string[] {
  const text = `${category} ${title}`;
  return SUGGESTIONS.find(rule => rule.pattern.test(text))?.keys ?? [];
}

export default function CourseAiToolsPicker({ value, onChange, category, title }: { value: string[]; onChange: (keys: string[]) => void; category: string; title: string }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {at('Included AI tools')}{' '}
          <span className="text-gray-400 font-normal">{at('— free for enrolled students until they finish the course (max 90 days)')}</span>
        </label>
        <button type="button" onClick={() => onChange(suggestCourseAiTools(category, title))} className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:underline">
          <Wand2 className="w-3.5 h-3.5" aria-hidden />{at('Suggest')}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="course-ai-tools">
        {COURSE_AI_TOOL_OPTIONS.map(option => (
          <label key={option.key} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={value.includes(option.key)} onChange={() => toggle(option.key)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
