import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ExternalLink } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import Lightbox from '../../src/components/shared/Lightbox';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import { SuccessStory } from '../../src/types/successStory';
import { getSuccessStoryBySlug, successStoryRoleTitle, successStoryTestimonial, successStoryContent } from '../../src/services/successStoryService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'ისტორია ვერ მოიძებნა.',
    backToStories: '← ყველა ისტორია',
    course: 'დასრულებული კურსი',
    viewPortfolio: 'პორტფოლიოს ნახვა →',
    gallery: 'გალერეა',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Story not found.',
    backToStories: '← All Stories',
    course: 'Completed Course',
    viewPortfolio: 'View Portfolio →',
    gallery: 'Gallery',
  },
  de: {
    loading: 'Loading…',
    notFound: 'Story not found.',
    backToStories: '← All Stories',
    course: 'Completed Course',
    viewPortfolio: 'View Portfolio →',
    gallery: 'Gallery',
  },
  es: {
    loading: 'Loading…',
    notFound: 'Story not found.',
    backToStories: '← All Stories',
    course: 'Completed Course',
    viewPortfolio: 'View Portfolio →',
    gallery: 'Gallery',
  },
  fr: {
    loading: 'Loading…',
    notFound: 'Story not found.',
    backToStories: '← All Stories',
    course: 'Completed Course',
    viewPortfolio: 'View Portfolio →',
    gallery: 'Gallery',
  },
  uk: {
    loading: 'Loading…',
    notFound: 'Story not found.',
    backToStories: '← All Stories',
    course: 'Completed Course',
    viewPortfolio: 'View Portfolio →',
    gallery: 'Gallery',
  },
};

export default function SuccessStoryDetailPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // Success stories only store ka/en text — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';
  const slug = typeof router.query.slug === 'string' ? router.query.slug : undefined;

  const [story, setStory] = useState<SuccessStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async (currentSlug: string) => {
    setLoading(true);
    setNotFound(false);
    try {
      setStory(await getSuccessStoryBySlug(currentSlug));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) load(slug);
  }, [slug, load]);

  const galleryImages = (story?.galleryImages ?? []).map((url) => ({ url, alt: story?.studentName }));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${story?.studentName ?? t.loading} | CDC Success Stories`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-6 py-16 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/success-stories" label={t.backToStories} className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        ) : notFound || !story ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.notFound}</p>
        ) : (
          <article>
            <div className="flex flex-wrap items-center gap-5 mb-8">
              {story.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={story.avatarUrl}
                  alt={story.studentName}
                  onError={onImageErrorFallback}
                  className="w-20 h-20 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shrink-0">
                  {story.studentName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black mb-1">{story.studentName}</h1>
                <p className="text-sm font-bold text-cyan-500">{successStoryRoleTitle(story, contentLang)}</p>
                {story.hiredBy && (
                  <span className="inline-block mt-1.5 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    {story.hiredBy}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 mb-8 text-sm">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">{t.course}</span>
                <span className="font-semibold">{story.courseName}</span>
              </div>
              {story.portfolioUrl && (
                <a
                  href={story.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-blue-600 text-white no-underline shadow-md hover:shadow-lg transition-shadow"
                >
                  {t.viewPortfolio}
                  <ExternalLink size={13} />
                </a>
              )}
              {story.linkedinUrl && (
                <a
                  href={story.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-500 no-underline"
                >
                  <ExternalLink size={15} /> LinkedIn
                </a>
              )}
            </div>

            <blockquote className="border-l-4 border-cyan-500 pl-5 text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium italic mb-8">
              &ldquo;{successStoryTestimonial(story, contentLang)}&rdquo;
            </blockquote>

            {successStoryContent(story, contentLang) && (
              <div className="mb-10">
                <MarkdownContent content={successStoryContent(story, contentLang)!} />
              </div>
            )}

            {galleryImages.length > 0 && (
              <div>
                <h2 className="text-lg font-black mb-4">{t.gallery}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-0 cursor-zoom-in bg-slate-100 dark:bg-slate-800"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt ?? ''} onError={onImageErrorFallback} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </div>
      <SiteFooter />

      <Lightbox images={galleryImages} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
    </div>
  );
}
