import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { SuccessStory } from '../../src/types/successStory';
import { getSuccessStories, successStoryRoleTitle, successStoryTestimonial } from '../../src/services/successStoryService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';

const dict = {
  ka: {
    title: 'წარმატებული სტუდენტები',
    subtitle: 'ჩვენი კურსდამთავრებულების რეალური ისტორიები — დასაქმებიდან საკუთარ პროექტებამდე.',
    loading: 'იტვირთება…',
    empty: 'ისტორიები მალე დაემატება.',
    all: 'ყველა კურსი',
    readStory: 'ისტორიის წაკითხვა ↗',
  },
  en: {
    title: 'Success Stories',
    subtitle: "Real outcomes from CDC graduates — from landing a job to shipping their own projects.",
    loading: 'Loading…',
    empty: 'Stories will be added soon.',
    all: 'All Courses',
    readStory: 'Read the Story ↗',
  },
};

export default function SuccessStoriesPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStories(await getSuccessStories());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const courses = useMemo(() => Array.from(new Set(stories.map((s) => s.courseName))), [stories]);
  const filtered = useMemo(
    () => (activeCourse ? stories.filter((s) => s.courseName === activeCourse) : stories),
    [stories, activeCourse]
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

        {courses.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              type="button"
              onClick={() => setActiveCourse(null)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                activeCourse === null
                  ? 'bg-cyan-500 border-cyan-500 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400'
              }`}
            >
              {t.all}
            </button>
            {courses.map((course) => (
              <button
                key={course}
                type="button"
                onClick={() => setActiveCourse(course)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeCourse === course
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400'
                }`}
              >
                {course}
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
                href={`/success-stories/${item.slug}`}
                className="group block rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  {item.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.avatarUrl}
                      alt={item.studentName}
                      onError={onImageErrorFallback}
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                      {item.studentName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base font-black truncate">{item.studentName}</h3>
                    <p className="text-xs font-bold text-cyan-500 truncate">{successStoryRoleTitle(item, lang)}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-3 mb-4">
                  &ldquo;{successStoryTestimonial(item, lang)}&rdquo;
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-cyan-500">
                  {t.readStory}
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
