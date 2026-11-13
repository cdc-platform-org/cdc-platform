/**
 * Homepage "about" bento grid (#about).
 */
import { resolveBlogImageUrl } from '../../services/blogService';
import { Link as LinkIcon } from 'lucide-react';
import { HomepageContent, HomepageStat } from '../../types/siteContent';
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
  darkMode: boolean;
  cms: HomepageContent | null;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
}

export default function AboutBentoSection({ t, darkMode, cms, translate }: AboutBentoSectionProps) {
  return (
    <>
      {/* 📊 BENTO GRID SECTION */}
      <section id="about" className="max-w-7xl mx-auto pt-16 sm:pt-28 px-0 sm:px-6">
        <h2 className="section-title text-center mb-10 sm:mb-16 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('achievementsHeading')}</h2>
        {/* auto-rows only pins to a fixed 240px on md+, where the bento
            layout needs it for the row-span-2 HEKS card's math. Below that,
            a fixed row height clipped the HEKS card's image+text (which is
            taller than 240px once row-span-2 collapses to row-span-1 on a
            single mobile column) and the stat cards' wrapped labels — rows
            now size to their own content on mobile instead. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 auto-rows-auto md:auto-rows-[240px]">
          <div className={`md:col-span-2 md:row-span-2 rounded-3xl border backdrop-blur-md overflow-hidden flex flex-col transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white/60 border-slate-200'}`}>
            <img
              src={cms?.heksCard?.imageUrl ? resolveBlogImageUrl(cms.heksCard.imageUrl) : '/images/heks-eper.jpg'}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80';
              }}
              alt="HEKS/EPER Georgia"
              className={`w-full ${
                cms?.heksCard?.heightPreset === 'tall' ? 'h-80 sm:h-96' : 'h-64 sm:h-72'
              } object-cover ${
                HEKS_OBJECT_POSITION_CLASS[cms?.heksCard?.objectPosition ?? 'top']
              } rounded-t-3xl shrink-0`}
            />
            <div className="p-5 sm:p-8 md:p-10 flex-1 flex flex-col justify-center">
              <div className="flex items-center space-x-3 mb-6 text-sky-500">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-1.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zm0-11.85l.91 1.84 2.04 .3-1.48 1.44 .35 2.02-1.82-.96-1.82 .96 .35-2.02-1.48-1.44 2.04-.3 .91-1.84z" /></svg>
                <span className="text-xl font-black tracking-widest text-slate-400 font-sans">EU</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black mb-4">{t('heksSupportHeading')}</h3>
              <p className="text-sm md:text-base text-slate-400 leading-relaxed font-medium mb-5">{t('heksSupportBody')}</p>
              <a
                href="https://socialinnovation.ge/%e1%83%aa%e1%83%98%e1%83%a4%e1%83%a0%e1%83%a3%e1%83%9a%e1%83%98-%e1%83%9e%e1%83%a0%e1%83%9d%e1%83%a4%e1%83%94%e1%83%a1%e1%83%98%e1%83%91%e1%83%98%e1%83%a1-%e1%83%aa%e1%83%94%e1%83%9c%e1%83%a2/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 self-start text-xs font-bold uppercase tracking-wider text-cyan-500 hover:text-cyan-400 no-underline transition-colors"
              >
                {t('aboutProject')}
                <LinkIcon className="w-3 h-3" />
              </a>
            </div>
          </div>
          {(cms?.stats?.length ? cms.stats : DEFAULT_HOMEPAGE_STATS).map((stat, i) => (
            <div
              key={i}
              className={`rounded-3xl p-5 sm:p-8 border backdrop-blur-md flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white/60 border-slate-200'}`}
            >
              <span className={`text-5xl font-black ${i % 2 === 0 ? 'text-cyan-500' : 'text-purple-500'}`}>
                {translate(stat.valueKa, stat.valueEn)}
              </span>
              <span className="text-sm font-black uppercase tracking-wider text-slate-400 leading-relaxed">{translate(stat.labelKa, stat.labelEn)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
