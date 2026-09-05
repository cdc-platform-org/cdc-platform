import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ExternalLink } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import Lightbox from '../../src/components/shared/Lightbox';
import VideoEmbed from '../../src/components/shared/VideoEmbed';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import SEOHead from '../../src/components/seo/SEOHead';
import { StudioCaseStudy } from '../../src/types/studioCaseStudy';
import { getStudioCaseBySlug, studioCaseTitle, studioCaseDescription, studioCaseFullStory } from '../../src/services/studioCaseService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'ქეისი ვერ მოიძებნა.',
    backToCases: '← ყველა ქეისი',
    client: 'კლიენტი',
    category: 'კატეგორია',
    viewLive: 'პროექტის ნახვა →',
    gallery: 'გალერეა',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Case study not found.',
    backToCases: '← All Case Studies',
    client: 'Client',
    category: 'Category',
    viewLive: 'View Live Project →',
    gallery: 'Gallery',
  },
  de: {
    loading: 'Loading…',
    notFound: 'Case study not found.',
    backToCases: '← All Case Studies',
    client: 'Client',
    category: 'Category',
    viewLive: 'View Live Project →',
    gallery: 'Gallery',
  },
  es: {
    loading: 'Loading…',
    notFound: 'Case study not found.',
    backToCases: '← All Case Studies',
    client: 'Client',
    category: 'Category',
    viewLive: 'View Live Project →',
    gallery: 'Gallery',
  },
  fr: {
    loading: 'Loading…',
    notFound: 'Case study not found.',
    backToCases: '← All Case Studies',
    client: 'Client',
    category: 'Category',
    viewLive: 'View Live Project →',
    gallery: 'Gallery',
  },
  uk: {
    loading: 'Loading…',
    notFound: 'Case study not found.',
    backToCases: '← All Case Studies',
    client: 'Client',
    category: 'Category',
    viewLive: 'View Live Project →',
    gallery: 'Gallery',
  },
};

export default function StudioCaseDetailPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // Studio case studies only store ka/en text — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';
  const slug = typeof router.query.slug === 'string' ? router.query.slug : undefined;

  const [caseStudy, setCaseStudy] = useState<StudioCaseStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async (currentSlug: string) => {
    setLoading(true);
    setNotFound(false);
    try {
      setCaseStudy(await getStudioCaseBySlug(currentSlug));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) load(slug);
  }, [slug, load]);

  const displayTitle = caseStudy ? studioCaseTitle(caseStudy, contentLang) : undefined;
  const galleryImages = (caseStudy?.galleryImages ?? []).map((url) => ({ url, alt: displayTitle }));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SEOHead
        title={displayTitle ?? t.loading}
        description={caseStudy ? studioCaseDescription(caseStudy, contentLang).slice(0, 200) : t.loading}
        ogImage={caseStudy?.coverImageUrl ?? undefined}
        ogType="article"
        noIndex={!caseStudy}
      />
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-6 py-16 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/cases" label={t.backToCases} className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        ) : notFound || !caseStudy ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.notFound}</p>
        ) : (
          <article>
            {caseStudy.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={caseStudy.coverImageUrl}
                alt={displayTitle}
                onError={onImageErrorFallback}
                className="w-full aspect-video object-cover rounded-2xl mb-8 border border-slate-200 dark:border-slate-800"
              />
            )}

            <span className="text-[11px] font-black uppercase tracking-widest block mb-3 text-cyan-500">{caseStudy.category}</span>
            <h1 className="blog-heading-safe text-3xl font-black mb-6">{displayTitle}</h1>

            <div className="flex flex-wrap gap-6 mb-8 text-sm">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">{t.client}</span>
                <span className="font-semibold">{caseStudy.clientName}</span>
              </div>
              {caseStudy.projectUrl && (
                <a
                  href={caseStudy.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-blue-600 text-white no-underline shadow-md hover:shadow-lg transition-shadow"
                >
                  {t.viewLive}
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <MarkdownContent content={studioCaseDescription(caseStudy, contentLang)} className="text-base text-slate-600 dark:text-slate-300 font-medium mb-6" />

            {studioCaseFullStory(caseStudy, contentLang) && (
              <MarkdownContent content={studioCaseFullStory(caseStudy, contentLang) ?? ''} className="text-sm text-slate-500 dark:text-slate-400 mb-10" />
            )}

            {caseStudy.videoUrl && (
              <div className="mb-10">
                <VideoEmbed url={caseStudy.videoUrl} title={displayTitle} />
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
