import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Search, Clock, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import { BlogPost } from '../../src/types/blog';
import { getBlogPosts, resolveBlogImageUrl, blogTitle, blogDescription, blogContent, estimateReadingMinutes, isSuccessStory } from '../../src/services/blogService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { resolveLocale } from '@/src/utils/locale';

const POSTS_PER_PAGE = 9;

const dict = {
  ka: {
    title: 'ბლოგი',
    subtitle: 'სიახლეები, სტატიები და გამოცდილება ციფრული პროფესიების სამყაროდან.',
    loading: 'იტვირთება…',
    empty: 'სტატიები ჯერ არ არის დამატებული.',
    noResults: 'თქვენი ძიების შესაბამისი სტატია ვერ მოიძებნა.',
    readMore: 'სრულად წაკითხვა →',
    all: 'ყველა',
    graduateBadge: '🎓 კურსდამთავრებული',
    searchPlaceholder: 'ძებნა სათაურით ან აღწერით…',
    minRead: (n: number) => `${n} წთ კითხვა`,
    prev: 'წინა',
    next: 'შემდეგი',
  },
  en: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    noResults: 'No articles match your search.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
    searchPlaceholder: 'Search by title or description…',
    minRead: (n: number) => `${n} min read`,
    prev: 'Prev',
    next: 'Next',
  },
  de: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    noResults: 'No articles match your search.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
    searchPlaceholder: 'Search by title or description…',
    minRead: (n: number) => `${n} min read`,
    prev: 'Prev',
    next: 'Next',
  },
  es: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    noResults: 'No articles match your search.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
    searchPlaceholder: 'Search by title or description…',
    minRead: (n: number) => `${n} min read`,
    prev: 'Prev',
    next: 'Next',
  },
  fr: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    noResults: 'No articles match your search.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
    searchPlaceholder: 'Search by title or description…',
    minRead: (n: number) => `${n} min read`,
    prev: 'Prev',
    next: 'Next',
  },
  uk: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    noResults: 'No articles match your search.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
    searchPlaceholder: 'Search by title or description…',
    minRead: (n: number) => `${n} min read`,
    prev: 'Prev',
    next: 'Next',
  },
};

export default function BlogIndexPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // Blog posts only store ka/en text (title/titleEn etc.) — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBlogPosts();
      // The list endpoint is public and unfiltered (admins reuse it to see
      // drafts in the editor) — filter to published-only for this reader page.
      setPosts(data.filter((p) => p.published));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => Array.from(new Set(posts.map((p) => p.category))).sort(), [posts]);

  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeCategory && post.category !== activeCategory) return false;
      if (!query) return true;
      const haystack = `${blogTitle(post, contentLang)} ${blogDescription(post, contentLang)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [posts, activeCategory, searchQuery, lang]);

  // Reset to page 1 whenever the filtered set changes shape (new search/category).
  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / POSTS_PER_PAGE));
  const pagedPosts = visiblePosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

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
        ) : posts.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : visiblePosts.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.noResults}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current"
                >
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveBlogImageUrl(post.imageUrl)} alt={blogTitle(post, contentLang)} onError={onImageErrorFallback} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                      <FileText className="w-8 h-8 text-cyan-500/40" />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20 self-start">
                        {post.category}
                      </span>
                      {isSuccessStory(post) && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-amber-300 bg-amber-500/10 border-amber-500/20 self-start">
                          {t.graduateBadge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black mb-2 text-white line-clamp-2 break-words">{blogTitle(post, contentLang)}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-4 flex-1">{blogDescription(post, contentLang)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400">{t.readMore}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Clock size={12} />
                        {t.minRead(estimateReadingMinutes(blogContent(post, contentLang)))}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> {t.prev}
                </button>
                <span className="text-xs text-slate-500 font-bold">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t.next} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
