import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Search, X, ExternalLink, PlayCircle } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import { Tutorial } from '../../src/types/tutorial';
import { getTutorials, tutorialTitle, tutorialDescription, getEmbedUrl } from '../../src/services/tutorialService';
import { resolveLocale } from '@/src/utils/locale';

const EN_STRINGS = {
  title: 'Video Tutorials',
  subtitle: 'Short how-to videos for getting the most out of the CDC platform.',
  loading: 'Loading…',
  empty: 'No tutorials have been published yet.',
  noResults: 'No tutorials match your search.',
  all: 'All',
  searchPlaceholder: 'Search tutorials…',
  watch: 'Watch',
  openExternally: 'This video can\'t be embedded — open it in a new tab instead.',
  openInNewTab: 'Open video',
};

const dict = {
  ka: {
    title: 'ვიდეო ტუტორიალები',
    subtitle: 'მოკლე ვიდეო ინსტრუქციები CDC პლატფორმის გამოსაყენებლად.',
    loading: 'იტვირთება…',
    empty: 'ტუტორიალები ჯერ არ არის დამატებული.',
    noResults: 'თქვენი ძიების შესაბამისი ტუტორიალი ვერ მოიძებნა.',
    all: 'ყველა',
    searchPlaceholder: 'ტუტორიალების ძებნა…',
    watch: 'ყურება',
    openExternally: 'ეს ვიდეო ვერ ჩაშენდება — გახსენით ახალ ტაბში.',
    openInNewTab: 'ვიდეოს გახსნა',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

export default function TutorialsIndexPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // Tutorials only store ka/en text (title/titleEn etc.) — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTutorials();
      // The list endpoint is public and unfiltered (admins reuse it to see
      // drafts in the editor) — filter to published-only for this reader page.
      setTutorials(data.filter((tut) => !!tut.publishedAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => Array.from(new Set(tutorials.map((tut) => tut.category))).sort(), [tutorials]);

  const visibleTutorials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tutorials.filter((tut) => {
      if (activeCategory && tut.category !== activeCategory) return false;
      if (!query) return true;
      const haystack = `${tutorialTitle(tut, contentLang)} ${tutorialDescription(tut, contentLang)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [tutorials, activeCategory, searchQuery, contentLang]);

  const embedUrl = activeTutorial ? getEmbedUrl(activeTutorial.videoUrl) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="text-slate-400 hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

        <div className="relative mb-8 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-800 bg-slate-900/60 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {!loading && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`text-xs font-bold uppercase tracking-widest px-3.5 py-2 rounded-full border transition-colors ${
                activeCategory === null
                  ? 'text-white bg-cyan-500/20 border-cyan-500/40'
                  : 'text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {t.all}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`text-xs font-bold uppercase tracking-widest px-3.5 py-2 rounded-full border transition-colors ${
                  activeCategory === category
                    ? 'text-white bg-cyan-500/20 border-cyan-500/40'
                    : 'text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : tutorials.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : visibleTutorials.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.noResults}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTutorials.map((tut) => (
              <button
                key={tut.id}
                type="button"
                onClick={() => setActiveTutorial(tut)}
                className="text-left rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] cursor-pointer"
              >
                <div className="w-full h-40 bg-slate-800/80 flex items-center justify-center">
                  <PlayCircle size={40} className="text-cyan-400" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20 self-start mb-4">
                    {tut.category}
                  </span>
                  <h3 className="text-lg font-black mb-2 text-white line-clamp-2 break-words">{tutorialTitle(tut, contentLang)}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-4 flex-1">{tutorialDescription(tut, contentLang)}</p>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                    <PlayCircle size={14} /> {t.watch}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTutorial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setActiveTutorial(null)}
        >
          <div
            className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white truncate pr-4">{tutorialTitle(activeTutorial, contentLang)}</h3>
              <button
                type="button"
                onClick={() => setActiveTutorial(null)}
                className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {embedUrl ? (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  title={tutorialTitle(activeTutorial, contentLang)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400 mb-4">{t.openExternally}</p>
                <a
                  href={activeTutorial.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-400 hover:text-cyan-300"
                >
                  {t.openInNewTab} <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
