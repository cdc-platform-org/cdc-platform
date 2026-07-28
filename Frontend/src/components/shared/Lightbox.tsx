import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

export interface LightboxImage {
  url: string;
  alt?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  // null = closed. Any other index opens the lightbox at that image.
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const SWIPE_THRESHOLD_PX = 50;

// Full-screen image viewer reused across the photo gallery, blog post
// content images, and success-story avatars — Esc/backdrop-click closes,
// ←/→ (and on-screen arrows) cycle with wraparound, and a touch swipe does
// the same on mobile. Renders nothing when index is null.
export default function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const isOpen = index !== null && images.length > 0;
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(isOpen, onClose);

  // Move focus into the dialog on open so keyboard/screen-reader users land
  // somewhere sensible rather than the still-focused trigger button behind it.
  useEffect(() => {
    if (isOpen) containerRef.current?.focus();
  }, [isOpen]);

  const goPrev = () => {
    if (index === null) return;
    onIndexChange((index - 1 + images.length) % images.length);
  };
  const goNext = () => {
    if (index === null) return;
    onIndexChange((index + 1) % images.length);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, images.length]);

  // Lock page scroll while the lightbox is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || index === null) return null;
  const current = images[index];
  const hasMultiple = images.length > 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX > 0) goPrev();
    else goNext();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || 'Image viewer'}
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8 outline-none"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous image"
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt || ''}
        onError={onImageErrorFallback}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg select-none"
      />

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {hasMultiple && (
        <span aria-live="polite" className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold tracking-wider">
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
