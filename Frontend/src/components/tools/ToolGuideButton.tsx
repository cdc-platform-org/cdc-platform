import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { BookOpenCheck, Lightbulb, HelpCircle, X } from 'lucide-react';
import { getToolGuide, guideUi, ToolGuideKey } from './toolGuides';
import { toolSecondaryButton } from './ToolShell';

// "How to use" button for a tool page header. Opens a side panel with the
// tool's step-by-step guide, tips and FAQ (Georgian or English).
export default function ToolGuideButton({ guide }: { guide: ToolGuideKey }) {
  const { locale } = useRouter();
  const [open, setOpen] = useState(false);
  const g = getToolGuide(guide, locale);
  const ui = guideUi(locale);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={toolSecondaryButton} data-testid="tool-guide-open">
        <BookOpenCheck className="w-4 h-4" aria-hidden />
        {ui.open}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="tool-guide-title">
          <button type="button" aria-label={ui.close} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm border-none cursor-default" onClick={() => setOpen(false)} />
          <aside className="relative w-full max-w-lg h-full overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl px-5 sm:px-7 py-6" data-testid="tool-guide">
            <div className="flex items-start gap-3 mb-4">
              <h2 id="tool-guide-title" className="flex-1 text-xl font-black text-slate-900 dark:text-white leading-snug">{g.title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={ui.close} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{g.intro}</p>

            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{ui.steps}</h3>
            <ol className="list-none p-0 m-0 mb-7 space-y-4">
              {g.steps.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-sm font-black flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{s.t}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            {g.tips.length > 0 && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 mb-7">
                <h3 className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-200 mb-2">
                  <Lightbulb className="w-4 h-4" aria-hidden /> {ui.tips}
                </h3>
                <ul className="m-0 pl-5 space-y-1.5 text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
                  {g.tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>
            )}

            {g.faq.length > 0 && (
              <>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  <HelpCircle className="w-4 h-4" aria-hidden /> {ui.faq}
                </h3>
                <div className="space-y-2">
                  {g.faq.map((f) => (
                    <details key={f.q} className="group rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-bold text-slate-900 dark:text-white">{f.q}</summary>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
