import { GuideSection, TrainingDay, TrainingDayInput } from '../../services/trainingGuideService';

export const guideSectionLabels = {
  ka: { objectives: 'დღეს ვისწავლით', topics: 'დღის თემები', tools: 'ინსტრუმენტები და სერვისები', concepts: 'მთავარი ცნებები', demo: 'მენტორის დემო', exercise: 'დღის პრაქტიკული დავალება', outcome: 'მოსალოდნელი შედეგი', prompts: 'სასარგებლო პრომპტები', code: 'კოდის მაგალითები', troubleshooting: 'ხშირი შეცდომები და დახმარება', homework: 'საშინაო დავალება და მომზადება', preview: 'შემდეგი დღის მიმოხილვა', resources: 'სასწავლო რესურსები' },
  en: { objectives: 'Today we will learn', topics: 'Topics', tools: 'Tools and services', concepts: 'Key concepts', demo: 'Mentor demo', exercise: 'Practical exercise', outcome: 'Expected outcome', prompts: 'Useful prompts', code: 'Code snippets', troubleshooting: 'Common mistakes and troubleshooting', homework: 'Homework and preparation', preview: 'Next-day preview', resources: 'Resources' },
};

function safeResourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export default function TrainingDayContent({ day, lang, completedItemIds = [], busyItemIds = [], onToggle, onAsk }: {
  day: TrainingDay | TrainingDayInput;
  lang: 'ka' | 'en';
  completedItemIds?: string[];
  busyItemIds?: string[];
  onToggle?: (itemId: string, completed: boolean) => void;
  onAsk?: (section: GuideSection) => void;
}) {
  return <div className="space-y-5">
    {day.sections.filter((section) => section.items.length > 0).map((section) => <section key={section.id} aria-label={section.title || guideSectionLabels[lang][section.kind]} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-lg">{section.title || guideSectionLabels[lang][section.kind]}</h3>
        {onAsk && <button type="button" onClick={() => onAsk(section)} className="text-sm font-bold text-cyan-700 dark:text-cyan-300 hover:underline">{lang === 'ka' ? 'ჰკითხე IAKO-ს ამ თემაზე' : 'Ask IAKO about this topic'}</button>}
      </div>
      <ul className="space-y-5">
        {section.items.map((item) => {
          const resource = safeResourceUrl(item.url);
          return <li key={item.id} className="flex items-start gap-3">
            {onToggle && <input type="checkbox" checked={completedItemIds.includes(item.id)} disabled={busyItemIds.includes(item.id)} onChange={(event) => onToggle(item.id, event.target.checked)} aria-label={`${lang === 'ka' ? 'დასრულებულია' : 'Completed'}: ${item.title || section.title}`} className="mt-1 h-5 w-5 shrink-0 accent-cyan-600 cursor-pointer disabled:opacity-50" />}
            <div className="min-w-0 flex-1">
              {item.title && <h4 className="font-semibold break-words">{item.title}</h4>}
              {item.body && (section.kind === 'code' ? <div className="mt-2 rounded-xl bg-slate-950 text-slate-100 overflow-hidden">
                {item.language && <p className="px-4 pt-3 text-xs text-slate-400">{item.language}</p>}
                <pre className="p-4 text-sm overflow-x-auto"><code>{item.body}</code></pre>
              </div> : <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 dark:text-slate-300 ${section.kind === 'prompts' ? 'rounded-xl border-l-4 border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 px-4 py-3' : ''}`}>{item.body}</p>)}
              {resource && <a href={resource} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-cyan-700 dark:text-cyan-300 underline break-all">{lang === 'ka' ? 'რესურსის გახსნა' : 'Open resource'} ↗</a>}
            </div>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}
