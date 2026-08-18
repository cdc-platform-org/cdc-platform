import { useState, useEffect, useMemo } from 'react';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Search } from 'lucide-react';
import CategoryCard from '../../src/components/forum/CategoryCard';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { ForumCategory } from '../../src/types/forum';
import { getCategories } from '../../src/services/forumService';
import { resolveLocale } from '@/src/utils/locale';

function ForumIndexContent() {
  const { t } = useTranslation('forum');
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError(t('loadCategoriesError')))
      .finally(() => setLoading(false));
  }, [t]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (activeSlug && c.slug !== activeSlug) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    });
  }, [categories, search, activeSlug]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <div className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <BackButton fallbackHref="/" className="text-slate-500 dark:text-slate-400 dark:hover:text-slate-100" />

          <div className="text-center mt-8">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-full px-3 py-1 mb-4">
              CDC Community
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
              <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-8">
              {t('subtitle')}
            </p>

            <div className="max-w-lg mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder') as string}
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl pl-11 pr-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setActiveSlug(null)}
                  className={`text-xs font-bold px-4 py-2 rounded-full border transition ${
                    activeSlug === null
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500 dark:border-cyan-500'
                      : 'bg-white/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-500/50'
                  }`}
                >
                  {t('allCategories')}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveSlug(c.slug)}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition ${
                      activeSlug === c.slug
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500 dark:border-cyan-500'
                        : 'bg-white/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-500/50'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CATEGORY GRID */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-400 text-center">{t('loading')}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('noCategories')}</p>
        ) : filteredCategories.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('noSearchResults')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                slug={category.slug}
                name={category.name}
                description={category.description}
                threadCount={category.threadCount}
              />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function ForumIndexPage() {
  return <ForumIndexContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['forum'])) },
});
