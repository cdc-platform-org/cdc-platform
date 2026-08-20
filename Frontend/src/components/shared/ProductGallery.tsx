import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import Lightbox from './Lightbox';

interface ProductGalleryProps {
  // imageUrl (the cover) first, then previewImages — caller decides order.
  images: string[];
  alt: string;
}

// Amazon/Gumroad-style product gallery: one large image with a thumbnail
// strip underneath. Clicking the main image opens the existing Lightbox
// (same full-screen zoom/arrows/swipe used by the studio-case gallery) for
// a closer look. Renders a single static image with no thumbnail row or
// arrows when there's only one (today's default for most products, since
// previewImages is optional).
export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasMultiple = images.length > 1;

  const goPrev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % images.length);

  return (
    <div>
      {/* 4:3, matching the marketplace card's aspect and the admin upload
          form's "optimal cover size" guidance — was aspect-video (16:9)
          before, which cropped a portrait cover far more aggressively than
          the listing card two clicks away ever showed. object-cover still
          crops to fill (never stretches), but the shallower 4:3 box keeps
          noticeably more of a tall image's vertical center in frame. */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 group">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={alt}
          className="absolute inset-0 w-full h-full border-none p-0 bg-transparent cursor-zoom-in"
        >
          <Image src={images[activeIndex]} alt={alt} fill className="object-cover" unoptimized />
          <span className="absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-4 h-4" />
          </span>
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer border-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer border-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`${alt} ${idx + 1}`}
              className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 p-0 cursor-pointer transition-colors ${
                idx === activeIndex ? 'border-cyan-500' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={url} alt="" fill className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        images={images.map((url) => ({ url, alt }))}
        index={lightboxOpen ? activeIndex : null}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActiveIndex}
      />
    </div>
  );
}
