/**
 * Homepage FAQ, managed in the CMS (hidden when no questions are set).
 */
import { HomepageContent } from '../../types/siteContent';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

interface FaqSectionProps {
  cms: HomepageContent | null;
  darkMode: boolean;
  t: TFunction<"home", undefined>;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
}

export default function FaqSection({ cms, darkMode, t, translate }: FaqSectionProps) {
  return (
    <>
      {/* ❓ FAQ SECTION — CMS-managed, hidden entirely with no questions set */}
      {!!cms?.faq?.length && (
        <section className={`py-16 sm:py-28 border-t ${darkMode ? 'bg-[#0e1422]/20 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="section-title text-center mb-10 sm:mb-16 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('faqHeading')}</h2>
            <div className="space-y-3">
              {cms.faq.map((item, i) => (
                <details
                  key={i}
                  className={`group rounded-2xl border px-6 py-4 transition-all duration-300 ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-sm md:text-base">
                    {translate(item.questionKa, item.questionEn)}
                    <span className="shrink-0 text-cyan-500 transition-transform duration-300 group-open:rotate-45 text-xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed font-medium">{translate(item.answerKa, item.answerEn)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
