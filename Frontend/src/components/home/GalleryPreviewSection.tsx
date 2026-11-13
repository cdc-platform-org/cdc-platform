/**
 * Homepage CDC Life photo gallery preview (hidden when there are no photos).
 */
import Link from 'next/link';
import { resolveBlogImageUrl } from '../../services/blogService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { GalleryImage } from '../../types/siteContent';
import type { TFunction } from 'i18next';

interface GalleryPreviewSectionProps {
  galleryPreview: GalleryImage[];
  t: TFunction<"home", undefined>;
  darkMode: boolean;
}

export default function GalleryPreviewSection({ galleryPreview, t, darkMode }: GalleryPreviewSectionProps) {
  return (
    <>
      {/* 🖼️ CDC LIFE — PHOTO GALLERY PREVIEW */}
      {galleryPreview.length > 0 && (
        <section className="max-w-7xl mx-auto pt-16 sm:pt-28 px-0 sm:px-6">
          <h2 className="section-title text-center mb-10 sm:mb-16 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('galleryHeading')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {galleryPreview.map((img, i) => (
              <Link
                key={i}
                href="/gallery"
                className={`relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 transform hover:scale-[1.02] no-underline ${darkMode ? 'bg-slate-800 border-slate-800' : 'bg-slate-100 border-slate-200'}`}
              >
                {/* bg-slate-800/100 on the wrapper above (rather than
                    leaving it transparent) is the actual fix for the "empty
                    white block" report — on a slow mobile connection an
                    unloaded <img> shows nothing but its background until it
                    decodes, and a transparent one over a light section reads
                    as a blank white card. loading="lazy" so off-screen
                    gallery tiles don't compete with above-the-fold requests. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveBlogImageUrl(img.url)}
                  alt={img.captionKa ?? img.captionEn ?? ''}
                  onError={onImageErrorFallback}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 border font-black text-sm px-6 py-3 rounded-xl transition no-underline border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10"
            >
              {t('seeAllPhotos')} →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
