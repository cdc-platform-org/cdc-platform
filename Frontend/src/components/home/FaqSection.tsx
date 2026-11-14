/**
 * Homepage FAQ, managed in the CMS (hidden when no questions are set).
 * 2026-11 redesign: Figma-style split layout — heading on the left, the
 * accordion in a white card on the right (cdc-* tokens).
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { HomepageContent } from '../../types/siteContent';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

interface FaqSectionProps {
  cms: HomepageContent | null;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  t: TFunction<"home", undefined>;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
}

export default function FaqSection({ cms, t, translate }: FaqSectionProps) {
  if (!cms?.faq?.length) return null;
  return (
    <section className="max-w-7xl mx-auto py-16 sm:py-24">
      <div className="vip-card p-6 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-8 lg:gap-14">
        <div>
          <h2 style={{ lineHeight: 1.25 }} className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight text-cdc-ink">
            {t('faqHeading')}
          </h2>
          <Link href="/contact" className="vip-btn-secondary mt-6 no-underline">
            {translate('დაგვიკავშირდით', 'Contact us')}
          </Link>
        </div>
        <div className="space-y-3">
          {cms.faq.map((item, i) => (
            <details key={i} className="group rounded-xl border border-cdc-border bg-cdc-surface px-5 py-4 open:bg-cdc-bg transition-colors">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-sm md:text-base text-cdc-ink">
                {translate(item.questionKa, item.questionEn)}
                <span className="w-9 h-9 shrink-0 rounded-lg bg-cdc-primary-soft text-cdc-primary-ink flex items-center justify-center transition-transform duration-300 group-open:rotate-45">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-cdc-muted">{translate(item.answerKa, item.answerEn)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
