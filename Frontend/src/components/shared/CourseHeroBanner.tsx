import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface CourseHeroBannerProps {
  src: string;
  alt: string;
  className?: string;
  // Off for the small admin-form preview by default (a fixed-size inline
  // thumbnail doesn't need its own full-screen zoom) — on everywhere else.
  enableLightbox?: boolean;
}

// Full-bleed course banners (title text, diagrams, borders baked into the
// image itself — e.g. "Business English for Startup Pitching") were
// getting cropped by a fixed-height object-cover container, losing exactly
// the content that makes them work. This renders the whole image via
// object-contain instead, with a blurred/darkened copy of the same image
// filling the frame behind it so a non-16:9 banner never shows stark empty
// bars — same "blurred backdrop behind a contained image" pattern used by
// video players and photo apps for exactly this problem.
export default function CourseHeroBanner({ src, alt, className, enableLightbox = true }: CourseHeroBannerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEscapeToClose(lightboxOpen, () => setLightboxOpen(false));

  return (
    <>
      <div
        className={`group relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 shadow-xl shadow-purple-500/10 ${
          enableLightbox ? 'cursor-zoom-in' : ''
        } ${className ?? ''}`}
        onClick={() => enableLightbox && setLightboxOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="relative h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
        {enableLightbox && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {enableLightbox && lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute right-5 top-5 cursor-pointer rounded-full border-none bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
