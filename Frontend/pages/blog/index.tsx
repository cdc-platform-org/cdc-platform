import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { BlogPost } from '../../src/types/blog';
import { getBlogPosts, resolveBlogImageUrl, blogTitle, blogDescription, isSuccessStory } from '../../src/services/blogService';

const dict = {
  ka: {
    title: 'ბლოგი',
    subtitle: 'სიახლეები, სტატიები და გამოცდილება ციფრული პროფესიების სამყაროდან.',
    loading: 'იტვირთება…',
    empty: 'სტატიები ჯერ არ არის დამატებული.',
    readMore: 'სრულად წაკითხვა →',
    all: 'ყველა',
    graduateBadge: '🎓 კურსდამთავრებული',
  },
  en: {
    title: 'Blog',
    subtitle: 'News, articles, and insights from the world of digital careers.',
    loading: 'Loading…',
    empty: 'No articles have been published yet.',
    readMore: 'Read more →',
    all: 'All',
    graduateBadge: '🎓 Graduate Success',
  },
};

export default function BlogIndexPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
  const visiblePosts = activeCategory ? posts.filter((p) => p.category === activeCategory) : posts;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

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
        ) : visiblePosts.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current"
              >
                {post.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveBlogImageUrl(post.imageUrl)} alt={blogTitle(post, lang)} className="w-full h-40 object-cover" />
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
                  <h3 className="text-lg font-black mb-2 text-white">{blogTitle(post, lang)}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-4 flex-1">{blogDescription(post, lang)}</p>
                  <span className="text-xs font-bold text-cyan-400">{t.readMore}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
