/**
 * Homepage "about" block (#about): the HEKS/EPER support card plus the
 * CMS-editable stats, laid out as flat white "benefit" cards with large
 * numbers (2026-11 redesign, Figma e-learning template inspiration).
 * Colours come from cdc-* tokens, so there are no dark-mode branches.
 */
import { resolveBlogImageUrl } from '../../services/blogService';
import { ArrowUpRight, Link as LinkIcon } from 'lucide-react';
import { HomepageContent, HomepageStat } from '../../types/siteContent';
import SectionHeader from './SectionHeader';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

const DEFAULT_HOMEPAGE_STATS: HomepageStat[] = [
  { valueKa: '200+', labelKa: 'კურსდამთავრებული', valueEn: '200+', labelEn: 'Graduates' },
  { valueKa: '100%', labelKa: 'პრაქტიკული დავალებები', valueEn: '100%', labelEn: 'Practical Tasks' },
];

// Tailwind's JIT scanner needs complete literal class names in source — an
// interpolated `object-${x}` string would silently produce no CSS, so this
// maps the CMS-editable position value to a fully literal class instead.
const HEKS_OBJECT_POSITION_CLASS: Record<'top' | 'center' | 'bottom', string> = {
  top: 'object-top',
  center: 'object-center',
  bottom: 'object-bottom',
};

interface AboutBentoSectionProps {
  t: TFunction<"home", undefined>;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  cms: HomepageContent | null;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
}

export default function AboutBentoSection({ t, cms, translate }: AboutBentoSectionProps) {
  const stats = cms?.stats?.length ? cms.stats : DEFAULT_HOMEPAGE_STATS;
  return (
    <section id="about" className="max-w-7xl mx-auto pt-16 sm:pt-24">
      <SectionHeader title={t('achievementsHeading')} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* HEKS/EPER support card — image + text side by side on lg+. */}
        <div className="vip-card lg:col-span-2 lg:row-span-2 overflow-hidden flex flex-col sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cms?.heksCard?.imageUrl ? resolveBlogImageUrl(cms.heksCard.imageUrl) : '/images/heks-eper.jpg'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80';
            }}
            alt="HEKS/EPER Georgia"
            className={`w-full sm:w-1/2 ${
              cms?.heksCard?.heightPreset === 'tall' ? 'h-80 sm:h-auto' : 'h-64 sm:h-auto'
            } object-cover ${HEKS_OBJECT_POSITION_CLASS[cms?.heksCard?.objectPosition ?? 'top']} shrink-0`}
          />
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
            <span className="cdc-chip self-start mb-5">HEKS/EPER · EU</span>
            <h3 className="text-xl md:text-2xl font-extrabold text-cdc-ink mb-3">{t('heksSupportHeading')}</h3>
            <p className="text-sm md:text-base leading-relaxed text-cdc-muted mb-6">{t('heksSupportBody')}</p>
            <a
              href="https://socialinnovation.ge/%e1%83%aa%e1%83%98%e1%83%a4%e1%83%a0%e1%83%a3%e1%83%9a%e1%83%98-%e1%83%9e%e1%83%a0%e1%83%9d%e1%83%a4%e1%83%94%e1%83%a1%e1%83%98%e1%83%91%e1%83%98%e1%83%a1-%e1%83%aa%e1%83%94%e1%83%9c%e1%83%a2/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-cdc-primary-ink hover:underline no-underline"
            >
              {t('aboutProject')}
              <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        {stats.map((stat, i) => (
          <div key={i} className="vip-card p-6 sm:p-8 flex flex-col justify-between gap-8 min-h-[180px]">
            <div className="flex items-start justify-between gap-4">
              <span className="text-5xl font-extrabold tracking-tight text-cdc-ink">{translate(stat.valueKa, stat.valueEn)}</span>
              <span className="text-sm font-bold text-cdc-muted/60">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <span className="text-base font-bold text-cdc-ink leading-snug">{translate(stat.labelKa, stat.labelEn)}</span>
              <span className="w-10 h-10 shrink-0 rounded-xl bg-cdc-primary-soft text-cdc-primary-ink flex items-center justify-center" aria-hidden="true">
                <ArrowUpRight className="w-5 h-5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
