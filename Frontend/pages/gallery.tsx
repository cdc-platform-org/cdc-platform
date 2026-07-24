import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import { GalleryContent } from '../src/types/siteContent';
import { getSiteContent } from '../src/services/siteContentService';
import { resolveBlogImageUrl } from '../src/services/blogService';

const dict = {
  ka: {
    title: 'ფოტოგალერეა',
    subtitle: 'მომენტები CDC-ის ცხოვრებიდან — ლექციები, ღონისძიებები და კურსდამთავრებულები.',
    empty: 'ფოტოები ჯერ არ არის დამატებული.',
  },
  en: {
    title: 'Photo Gallery',
    subtitle: 'Moments from CDC life — lectures, events, and graduates.',
    empty: 'No photos have been added yet.',
  },
};

export default function GalleryPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [images, setImages] = useState<GalleryContent['images']>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getSiteContent<GalleryContent>('gallery');
      setImages(row?.content.images ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = images ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{t.title} | CDC Platform</title>
      </Head>
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex-1 w-full">
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10">{t.subtitle}</p>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {list.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-transparent p-0 cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveBlogImageUrl(img.url)}
                  alt={(lang === 'en' && img.captionEn) || img.captionKa || ''}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {(img.captionKa || img.captionEn) && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs font-semibold px-3 py-2 text-left">
                    {(lang === 'en' && img.captionEn) || img.captionKa}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && list[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setLightboxIndex(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveBlogImageUrl(list[lightboxIndex].url)}
            alt={(lang === 'en' && list[lightboxIndex].captionEn) || list[lightboxIndex].captionKa || ''}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}
