import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { StudioCaseStudy } from '../../types/studioCaseStudy';
import { getStudioCases } from '../../services/studioCaseService';
import { onImageErrorFallback } from '../../utils/imageFallback';

interface FeaturedCaseStudiesProps {
  lang: 'ka' | 'en';
  darkMode?: boolean;
}

const dict = {
  ka: {
    title: 'გამორჩეული ქეისები',
    subtitle: 'პროექტები, რომლებიც CDC Studio-მ რეალურ ბიზნესებთან ერთად შექმნა.',
    viewAll: 'ყველა ქეისი →',
  },
  en: {
    title: 'Featured Case Studies',
    subtitle: 'Projects CDC Studio has delivered for real businesses.',
    viewAll: 'All Case Studies →',
  },
};

// Homepage "Featured Case Studies" block — fetches isFeatured StudioCaseStudy
// rows from GET /api/studio/cases?featured=true. Renders nothing while
// loading or if none are marked featured yet, same posture as SuccessStoriesCarousel.
export default function FeaturedCaseStudies({ lang, darkMode = false }: FeaturedCaseStudiesProps) {
  const t = dict[lang];
  const [cases, setCases] = useState<StudioCaseStudy[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getStudioCases(true)
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || cases.length === 0) return null;

  return (
    <section className={`py-28 border-t ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-50/60 border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-center mb-3 text-2xl md:text-3xl font-black tracking-wide">{t.title}</h2>
        <p className={`text-center text-sm mb-14 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cases.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              href={`/cases/${item.slug}`}
              className={`group block rounded-3xl border overflow-hidden transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] no-underline text-current ${
                darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`aspect-video overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {item.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    onError={onImageErrorFallback}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="p-6">
                <span className="text-[11px] font-black uppercase tracking-widest block mb-2 text-cyan-500">{item.category}</span>
                <h3 className="text-lg font-black mb-2 flex items-center gap-1.5">
                  {item.title}
                  <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-2">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-14">
          <Link
            href="/cases"
            className={`inline-block px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest border transition-all duration-300 hover:scale-105 ${
              darkMode ? 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10' : 'border-cyan-500 text-cyan-600 hover:bg-cyan-50'
            }`}
          >
            {t.viewAll}
          </Link>
        </div>
      </div>
    </section>
  );
}
