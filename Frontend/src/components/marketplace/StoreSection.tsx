// One titled block of the Digital Store (AI tools, coloring pages, other
// products...): shows the first `initial` items and a "Show more" button
// that reveals the rest in place (and "Show less" to fold them again).
import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StoreSectionProps<T> {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  items: T[];
  initial: number;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
  showMoreLabel: string;
  showLessLabel: string;
  action?: ReactNode;
}

export default function StoreSection<T>({ id, emoji, title, subtitle, items, initial, renderItem, getKey, showMoreLabel, showLessLabel, action }: StoreSectionProps<T>) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, initial);
  const hidden = items.length - initial;

  return (
    <section id={id} className="mb-12 scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 id={`${id}-title`} className="text-lg md:text-xl font-black tracking-wide flex items-center gap-2">
            <span aria-hidden>{emoji}</span>
            {title}
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">({items.length})</span>
          </h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((item) => (
          <div key={getKey(item)} className="flex">
            {renderItem(item)}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={id}
            className="inline-flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
          >
            {expanded ? (
              <>
                {showLessLabel} <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                {showMoreLabel} (+{hidden}) <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
