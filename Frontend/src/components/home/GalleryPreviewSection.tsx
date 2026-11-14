/**
 * Homepage CDC Life photo gallery preview (hidden when there are no photos).
 * 2026-11 redesign: SectionHeader + rounded photo tiles on cdc-* tokens.
 */
import Link from 'next/link';
import { resolveBlogImageUrl } from '../../services/blogService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import SectionHeader from './SectionHeader';
import { GalleryImage } from '../../types/siteContent';
import type { TFunction } from 'i18next';

interface GalleryPreviewSectionProps {
  galleryPreview: GalleryImage[];
  t: TFunction<"home", undefined>;
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
}

export default function GalleryPreviewSection({ galleryPreview, t }: GalleryPreviewSectionProps) {
  if (galleryPreview.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto pt-16 sm:pt-24">
      <SectionHeader title={t('galleryHeading')} action={{ href: '/gallery', label: t('seeAllPhotos') }} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
        {galleryPreview.map((img, i) => (
          <Link
            key={i}
            href="/gallery"
            className="group relative aspect-square rounded-card overflow-hidden border border-cdc-border bg-cdc-primary-soft no-underline"
          >
            {/* The tinted wrapper background shows while a slow image loads,
                instead of a blank card; lazy so off-screen tiles don't
                compete with above-the-fold requests. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveBlogImageUrl(img.url)}
              alt={img.captionKa ?? img.captionEn ?? ''}
              onError={onImageErrorFallback}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
