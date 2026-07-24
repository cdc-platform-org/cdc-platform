import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Course } from '../src/types/lms';
import { BlogPost } from '../src/types/blog';
import { getCourses } from '../src/services/courseService';
import { getBlogPosts, blogTitle, blogDescription } from '../src/services/blogService';
import { formatPrice } from '../src/utils/coursePricing';

const dict = {
  ka: {
    title: 'ძიების შედეგები',
    placeholder: 'მოძებნე კურსი, ბლოგი...',
    resultsFor: (q: string) => `შედეგები მოთხოვნისთვის: "${q}"`,
    loading: 'იტვირთება…',
    empty: 'ვერაფერი მოიძებნა თქვენი მოთხოვნისთვის.',
    courses: 'კურსები',
    blog: 'ბლოგი',
    viewDetails: 'ვრცლად →',
  },
  en: {
    title: 'Search Results',
    placeholder: 'Search courses, blog...',
    resultsFor: (q: string) => `Results for: "${q}"`,
    loading: 'Loading…',
    empty: 'Nothing matched your search.',
    courses: 'Courses',
    blog: 'Blog',
    viewDetails: 'View Details →',
  },
};

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export default function SearchPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const query = typeof router.query.q === 'string' ? router.query.q : '';

  const [inputValue, setInputValue] = useState(query);
  const [courses, setCourses] = useState<Course[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesData, postsData] = await Promise.all([getCourses(), getBlogPosts().catch(() => [])]);
      setCourses(coursesData.filter((c) => c.published));
      setPosts(postsData.filter((p) => p.published));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matchedCourses = useMemo(
    () => courses.filter((c) => matches(query, c.title, c.description, c.category, c.mentorName)),
    [courses, query]
  );
  const matchedPosts = useMemo(
    () => posts.filter((p) => matches(query, p.title, p.description, p.category, p.content)),
    [posts, query]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(inputValue.trim())}`);
  };

  const hasResults = matchedCourses.length > 0 || matchedPosts.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-black mb-6">{t.title}</h1>

        <form onSubmit={handleSubmit} className="relative mb-4 max-w-xl">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t.placeholder}
            className="w-full text-sm pl-10 pr-4 py-3 rounded-xl border bg-[#161f30] border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>

        {query && <p className="text-slate-400 text-sm mb-10">{t.resultsFor(query)}</p>}

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : !query || !hasResults ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="space-y-14">
            {matchedCourses.length > 0 && (
              <div>
                <h2 className="text-xl font-black mb-5">
                  {t.courses} ({matchedCourses.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matchedCourses.map((course) => (
                    <div
                      key={course.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]"
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-300 bg-purple-500/10 border-purple-500/20">
                          {course.category}
                        </span>
                        <h3 className="text-lg font-black mt-4 mb-2 text-white">{course.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-3">{course.description}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg font-black text-white">{formatPrice(course.currentPrice)}</span>
                        <Link
                          href={`/courses/${course.id}`}
                          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 no-underline"
                        >
                          {t.viewDetails}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchedPosts.length > 0 && (
              <div>
                <h2 className="text-xl font-black mb-5">
                  {t.blog} ({matchedPosts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matchedPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.id}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20 self-start mb-4">
                        {post.category}
                      </span>
                      <h3 className="text-lg font-black mb-2 text-white">{blogTitle(post, lang)}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{blogDescription(post, lang)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
