import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { StudioCaseStudy } from '../../src/types/studioCaseStudy';
import { getStudioCases, studioCaseTitle, studioCaseDescription } from '../../src/services/studioCaseService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';

const dict = {
  ka: {
    title: 'CDC Studio ქეისები',
    subtitle: 'პროექტები, რომლებიც CDC Studio-მ რეალურ ბიზნესებთან ერთად შექმნა.',
    loading: 'იტვირთება…',
    empty: 'ქეისები მალე დაემატება.',
    all: 'ყველა',
  },
  en: {
    title: 'CDC Studio Case Studies',
    subtitle: 'Projects CDC Studio has delivered for real businesses.',
    loading: 'Loading…',
    empty: 'Case studies will be added soon.',
    all: 'All',
  },
};

export default function StudioCasesPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [cases, setCases] = useState<StudioCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await getStudioCases());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => Array.from(new Set(cases.map((c) => c.category))), [cases]);
  const filtered = useMemo(
    () => (activeCategory ? cases.filter((c) => c.category === activeCategory) : cases),
    [cases, activeCategory]
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-6 py-16 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-2xl">{t.subtitle}</p>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                activeCategory === null
                  ? 'bg-cyan-500 border-cyan-500 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400'
              }`}
            >
              {t.all}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeCategory === category
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/cases/${item.slug}`}
                className="group block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current"
              >
                <div className="aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {item.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverImageUrl}
                      alt={studioCaseTitle(item, lang)}
                      onError={onImageErrorFallback}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-6">
                  <span className="text-[11px] font-black uppercase tracking-widest block mb-2 text-cyan-500">{item.category}</span>
                  <h3 className="text-lg font-black mb-2 flex items-center gap-1.5">
                    {studioCaseTitle(item, lang)}
                    <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-2">{studioCaseDescription(item, lang)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <SiteFooter lang={lang === 'en' ? 'ENG' : 'GEO'} />
    </div>
  );
}
